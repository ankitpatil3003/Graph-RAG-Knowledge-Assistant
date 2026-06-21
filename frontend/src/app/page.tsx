"use client";

import { useState, useCallback } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { GraphVisualization } from "@/components/GraphVisualization";
import { StatusBar } from "@/components/StatusBar";
import { EvalDashboard } from "@/components/EvalDashboard";

type Tab = "chat" | "eval";

export default function Home() {
  const [graphKey, setGraphKey] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  const refreshGraph = useCallback(() => {
    setGraphKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              Graph RAG Knowledge Assistant
            </h1>
            <p className="text-sm text-gray-500">
              Query financial filings with graph-enhanced retrieval
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "chat"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab("eval")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "eval"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Evaluation
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Main area */}
        <div className="flex-1 flex flex-col">
          {activeTab === "chat" ? (
            <>
              <div className="border-b bg-white px-6 py-4">
                <FileUpload onIngested={refreshGraph} />
              </div>
              <ChatPanel />
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
              <EvalDashboard />
            </div>
          )}
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
