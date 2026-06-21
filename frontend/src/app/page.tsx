"use client";

import { useState, useCallback } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { GraphVisualization } from "@/components/GraphVisualization";
import { StatusBar } from "@/components/StatusBar";

export default function Home() {
  const [graphKey, setGraphKey] = useState(0);

  const refreshGraph = useCallback(() => {
    setGraphKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Graph RAG Knowledge Assistant</h1>
        <p className="text-sm text-gray-500">
          Query financial filings with graph-enhanced retrieval
        </p>
      </header>

      <div className="flex-1 flex">
        {/* Main area */}
        <div className="flex-1 flex flex-col">
          {/* Upload bar */}
          <div className="border-b bg-white px-6 py-4">
            <FileUpload onIngested={refreshGraph} />
          </div>

          {/* Chat */}
          <ChatPanel />
        </div>

        {/* Sidebar */}
        <aside className="w-96 border-l bg-white p-4 hidden lg:flex flex-col gap-4 overflow-y-auto">
          <h2 className="font-medium text-sm text-gray-500">Knowledge Graph</h2>
          <GraphVisualization key={graphKey} />
          <StatusBar />
        </aside>
      </div>
    </main>
  );
}
