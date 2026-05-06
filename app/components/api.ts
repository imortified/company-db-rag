import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatRequest {
  question: string;
  model: string;
  session_id?: string;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
  model: string;
  sources?: string[];
}

export interface Document {
  id: number;
  filename: string;
  upload_timestamp: string;
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json"},
});

export async function listDocuments(): Promise<Document[]> {
  const { data } = await api.get<Document[]>("/list-docs");
  return data;
}

export async function deleteDocument(fileId: number) {
  const { data } = await api.post("/delete-doc", { file_id: fileId });
  return data;
}

export async function syncNotion() {
  const { data } = await api.post("/sync-notion");
  return data;
}

export async function getSyncStatus(taskId: string) {
  const { data } = await api.get(`/sync-status/${taskId}`);
  return data;
}

export async function sendChatMessage(req: ChatRequest) {
  const { data } = await api.post<ChatResponse>("/chat", req);
  return data;
}