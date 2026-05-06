"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type AccessibilitySettings = {
  highContrast: boolean;
  fontSize: "normal" | "large" | "x-large";
  voiceEnabled: boolean;
  voiceRate: number;
};

type AccessibilityContextType = {
  settings: AccessibilitySettings;
  toggleHighContrast: () => void;
  setFontSize: (size: "normal" | "large" | "x-large") => void;
  toggleVoice: () => void;
  setVoiceRate: (rate: number) => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
};

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  fontSize: "normal",
  voiceEnabled: false,
  voiceRate: 1,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return context;
};

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("accessibility");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("accessibility", JSON.stringify(settings));
    const root = document.documentElement;
    
    if (settings.highContrast) {
      root.classList.add("high-contrast");
      root.classList.remove("dark");
    } else {
      root.classList.remove("high-contrast");
    }
    
    root.classList.remove("font-normal-size", "font-large", "font-xlarge");

    const fontSizeClass = 
      settings.fontSize === "normal" ? "font-normal-size" :
      settings.fontSize === "large" ? "font-large" : "font-xlarge";
      
    root.classList.add(fontSizeClass);
      }, [settings]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!settings.voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
      
      stopSpeaking();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.voiceRate;
      utterance.pitch = 0.7; 
      utterance.lang = "ru-RU";
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    },
    [settings.voiceEnabled, settings.voiceRate, stopSpeaking]
  );

  const toggleHighContrast = () =>
    setSettings((prev) => ({ ...prev, highContrast: !prev.highContrast }));

  const setFontSize = (size: "normal" | "large" | "x-large") =>
    setSettings((prev) => ({ ...prev, fontSize: size }));

  const toggleVoice = () =>
    setSettings((prev) => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));

  const setVoiceRate = (rate: number) =>
    setSettings((prev) => ({ ...prev, voiceRate: rate }));

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        toggleHighContrast,
        setFontSize,
        toggleVoice,
        setVoiceRate,
        speak,
        stopSpeaking,
        isSpeaking,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};