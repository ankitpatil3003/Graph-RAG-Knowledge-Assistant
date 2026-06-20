"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { StatusBar } from "@/components/StatusBar";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Graph RAG Knowledge Assistant</h1>
        <p className="text-sm text-gray-500">
          Query financial filings with graph-enhanced retrieval
        </p>
      </header>

      <div className="flex-1 flex">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <ChatPanel />
        </div>

        {/* Sidebar — graph visualization placeholder */}
        <aside className="w-80 border-l bg-white p-4 hidden lg:block">
          <h2 className="font-medium text-sm text-gray-500 mb-3">
            Knowledge Graph
          </h2>
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">
            Graph visualization
          </div>
          <StatusBar />
        </aside>
      </div>
    </main>
  );
}
