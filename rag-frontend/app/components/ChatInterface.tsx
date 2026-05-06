"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage, ChatResponse } from "./api";
import { useAccessibility } from "../context/AccessibilityContext";
import { 
  Send, 
  User, 
  Bot, 
  Volume2, 
  Square,
  Loader2,
  FileText,
  Sparkles,
  Mic
} from "lucide-react";
import clsx from "clsx";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings, speak, stopSpeaking, isSpeaking } = useAccessibility();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const [isListening, setIsListening] = useState(false);

  // Проверка поддержки браузером
  const SpeechRecognition = 
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const isSpeechSupported = !!SpeechRecognition;

  // Функция запуска/остановки микрофона
  const toggleListening = () => {
    if (!isSpeechSupported) {
      alert("Ваш браузер не поддерживает голосовой ввод. Попробуйте Chrome.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = false; // Остановить после одной фразы
    recognition.interimResults = false; // Ждать финального результата

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSpeakMessage = useCallback(
    (content: string) => {
      if (isSpeaking) {
        stopSpeaking();
      } else {
        speak(content);
      }
    },
    [isSpeaking, speak, stopSpeaking]
  );

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response: ChatResponse = await sendChatMessage({
        question: userMsg.content,
        model: "llama3.2",
        session_id: sessionId || undefined,
      });

      setSessionId(response.session_id);

      const cleanAnswer = response.answer.replace(/Источники?:?\s*[\s\S]*$/, "").trim();

      const assistantMsg: Message = {
        role: "assistant",
        content: cleanAnswer || response.answer,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (settings.voiceEnabled) {
        setTimeout(() => speak(assistantMsg.content), 300);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Произошла ошибка при получении ответа. Пожалуйста, попробуйте ещё раз.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-chat-bg">
      {/* Header */}
      <header className="px-6 py-4 border-b border-sidebar-border flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">RAG-ассистент</h2>
            <p className="text-xs text-text-secondary">Модель: granite4.1</p>
          </div>
        </div>
        {sessionId && (
          <span className="text-xs text-text-secondary font-mono">
            Сессия: {sessionId.slice(0, 8)}...
          </span>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-text-secondary">
            <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-accent/40" />
            </div>
            <p className="text-lg font-medium text-text-primary mb-1">Чем могу помочь?</p>
            <p className="text-sm max-w-md text-center">
              Задайте вопрос по базе знаний компании. Я найду релевантную информацию в документах.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={clsx(
              "flex gap-4 message-animate",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-accent" />
              </div>
            )}

            <div className={clsx("max-w-[75%] space-y-2", msg.role === "user" && "order-first")}>
              <div
                className={clsx(
                  "rounded-2xl px-5 py-3.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-accent text-white rounded-br-md"
                    : "bg-message-assistant text-text-primary rounded-bl-md border border-gray-200 dark:border-gray-700"
                )}
              >
                {msg.content}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.sources.map((source, sIdx) => (
                    <span
                      key={sIdx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800"
                    >
                      <FileText className="w-3 h-3" />
                      {source}
                    </span>
                  ))}
                </div>
              )}

              {/* Voice button for assistant messages */}
              {msg.role === "assistant" && (
                <button
                  onClick={() => handleSpeakMessage(msg.content)}
                  className={clsx(
                    "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all",
                    isSpeaking
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : "text-text-secondary hover:text-accent hover:bg-accent/5"
                  )}
                >
                  {isSpeaking ? (
                    <>
                      <Square className="w-3 h-3" />
                      Остановить
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3" />
                      Озвучить
                    </>
                  )}
                </button>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-text-secondary" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 message-animate">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="bg-message-assistant rounded-2xl rounded-bl-md px-5 py-4 border border-gray-200 dark:border-gray-700">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-text-secondary loading-dot" />
                <span className="w-2 h-2 rounded-full bg-text-secondary loading-dot" />
                <span className="w-2 h-2 rounded-full bg-text-secondary loading-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-sidebar-border">
        <div className="max-w-3xl mx-auto relative flex items-center gap-2">
          {isSpeechSupported && (
            <button
              onClick={toggleListening}
              className={clsx(
                "p-3 rounded-xl transition-all",
                isListening 
                  ? "bg-red-100 text-red-600 animate-pulse" 
                  : "text-text-secondary hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
              title="Голосовой ввод"
            >
              {isListening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Говорите..." : "Задайте вопрос..."}
            disabled={isLoading || isListening}
            className="w-full pl-5 pr-14 py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border-0 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || isListening}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-accent text-white hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-accent transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-text-secondary mt-2">
          {isListening ? "Идет запись..." : "Нажмите Enter для отправки"}
        </p>
      </div>
    </div>
  );
}