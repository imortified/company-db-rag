"use client";

import Sidebar from "./components/Sidebar";
import ChatInterface from "./components/ChatInterface";

export default function Home() {
  return (
    <div className="flex h-screen bg-chat-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <ChatInterface />
      </main>
    </div>
  );
}