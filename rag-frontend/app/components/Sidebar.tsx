"use client";

import { useEffect, useState } from "react";
import { Document, listDocuments, deleteDocument, syncNotion, getSyncStatus } from "./api";
import { useAccessibility } from "../context/AccessibilityContext";
import { 
  RefreshCw, 
  Trash2, 
  FileText, 
  Sun, 
  Moon, 
  Type, 
  Volume2, 
  VolumeX,
  ChevronRight,
  Loader2,
  Database,
  Radio
} from "lucide-react";
import clsx from "clsx";

export default function Sidebar() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncTaskId, setSyncTaskId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const { settings, toggleHighContrast, setFontSize, toggleVoice, isSpeaking } = useAccessibility();

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await listDocuments();
      setDocs(data);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleDelete = async (id: number, filename: string) => {
    if (confirm(`Удалить документ "${filename}"?`)) {
      try {
        await deleteDocument(id);
        loadDocs();
      } catch (err) {
        alert("Ошибка при удалении документа");
      }
    }
  };

  const handleSyncNotion = async () => {
    try {
      const res = await syncNotion();
      if (res?.task_id) {
        setSyncTaskId(res.task_id);
        setSyncStatus("running");
        const interval = setInterval(async () => {
          try {
            const statusRes = await getSyncStatus(res.task_id);
            setSyncStatus(statusRes.status);
            if (statusRes.status.includes("completed") || statusRes.status.includes("failed")) {
              clearInterval(interval);
              if (statusRes.status.includes("completed")) loadDocs();
            }
          } catch {
            clearInterval(interval);
            setSyncStatus("failed");
          }
        }, 2000);
      }
    } catch {
      alert("Ошибка при запуске синхронизации");
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes("completed")) return "text-green-600";
    if (status.includes("failed")) return "text-red-600";
    if (status.includes("running")) return "text-blue-600";
    return "text-gray-500";
  };

  return (
    <aside className="w-80 bg-sidebar-bg border-r border-sidebar-border h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-1">
          <Database className="w-6 h-6 text-accent" />
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            База знаний Notion
          </h1>
        </div>
        <p className="text-sm text-text-secondary ml-9">RAG-система компании</p>
      </div>

      {/* Documents Section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Документы
          </h2>
          <button
            onClick={loadDocs}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Обновить список"
          >
            <RefreshCw className={clsx("w-4 h-4 text-text-secondary", loading && "animate-spin")} />
          </button>
        </div>

        {docs.length === 0 && !loading && (
          <div className="text-center py-8 text-text-secondary text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Нет загруженных документов
          </div>
        )}

        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="group flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-accent/30 hover:shadow-sm transition-all"
            >
              <FileText className="w-4 h-4 text-text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {doc.filename}
                </p>
                <p className="text-xs text-text-secondary">
                  {new Date(doc.upload_timestamp).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id, doc.filename)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all"
                title="Удалить"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>

        {/* Notion Sync */}
        <div className="mt-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            Интеграции
          </h2>
          <button
            onClick={handleSyncNotion}
            disabled={syncStatus === "running"}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-green-500/30 hover:shadow-sm transition-all disabled:opacity-60"
          >
            <Radio className="w-4 h-4 text-green-600" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-text-primary">Notion</p>
              <p className="text-xs text-text-secondary">
                {syncStatus === "running" ? "Синхронизация..." : "Синхронизировать"}
              </p>
            </div>
            {syncStatus === "running" ? (
              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            )}
          </button>

          {syncTaskId && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs">
              <p className="text-text-secondary mb-1">Task: {syncTaskId.slice(0, 8)}...</p>
              <p className={getStatusColor(syncStatus)}>
                Статус: {syncStatus}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Accessibility Panel */}
      <div className="p-4 border-t border-sidebar-border bg-gray-50/50 dark:bg-gray-900/50">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
          Доступность
        </h2>

        {/* High Contrast */}
        <button
          onClick={toggleHighContrast}
          className={clsx(
            "w-full flex items-center gap-3 p-3 rounded-xl mb-2 transition-all",
            settings.highContrast
              ? "bg-yellow-400/10 border border-yellow-400/30"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-accent/30"
          )}
        >
          {settings.highContrast ? (
            <Sun className="w-4 h-4 text-yellow-600" />
          ) : (
            <Moon className="w-4 h-4 text-text-secondary" />
          )}
          <span className="text-sm font-medium text-text-primary flex-1 text-left">
            {settings.highContrast ? "Обычный режим" : "Высокий контраст"}
          </span>
        </button>

        {/* Font Size */}
        <div className="flex items-center gap-2 mb-3">
          <Type className="w-4 h-4 text-text-secondary shrink-0" />
          <div className="flex-1 flex gap-1">
            {(["normal", "large", "x-large"] as const).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={clsx(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                  settings.fontSize === size
                    ? "bg-accent text-white"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-text-primary hover:border-accent/30"
                )}
              >
                {size === "normal" ? "A" : size === "large" ? "A+" : "A++"}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Toggle */}
        <button
          onClick={toggleVoice}
          className={clsx(
            "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
            settings.voiceEnabled
              ? "bg-blue-500/10 border border-blue-500/30"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-accent/30"
          )}
        >
          {settings.voiceEnabled ? (
            <Volume2 className={clsx("w-4 h-4 text-blue-600", isSpeaking && "animate-pulse")} />
          ) : (
            <VolumeX className="w-4 h-4 text-text-secondary" />
          )}
          <span className="text-sm font-medium text-text-primary flex-1 text-left">
            Озвучка ответов
          </span>
          <div
            className={clsx(
              "w-8 h-4 rounded-full relative transition-colors",
              settings.voiceEnabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
            )}
          >
            <div
              className={clsx(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                settings.voiceEnabled ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </div>
        </button>

        {isSpeaking && (
          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Идёт озвучка...
          </p>
        )}
      </div>
    </aside>
  );
}