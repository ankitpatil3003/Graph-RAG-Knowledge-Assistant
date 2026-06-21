"use client";

import { useState, useCallback } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { GraphVisualization } from "@/components/GraphVisualization";
import { StatusBar } from "@/components/StatusBar";
import { EvalDashboard } from "@/components/EvalDashboard";

type Tab = "chat" | "eval";
type View = "landing" | "app";

export default function Home() {
  const [graphKey, setGraphKey] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [view, setView] = useState<View>("landing");

  const refreshGraph = useCallback(() => {
    setGraphKey((k) => k + 1);
  }, []);

  if (view === "landing") {
    return <LandingPage onEnter={() => setView("app")} />;
  }

  return (
    <main className="h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="border-b px-6 py-3 flex items-center justify-between"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            G
          </div>
          <div>
            <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Graph RAG Assistant
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Financial Filing Intelligence
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          className="flex rounded-lg p-1 gap-1"
          style={{ background: "var(--bg-tertiary)" }}
        >
          {(["chat", "eval"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
              style={{
                background: activeTab === tab ? "var(--accent)" : "transparent",
                color: activeTab === tab ? "#fff" : "var(--text-secondary)",
              }}
            >
              {tab === "chat" ? "Chat" : "Evaluation"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setView("landing")}
          className="text-xs px-3 py-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-muted)", background: "var(--bg-tertiary)" }}
        >
          About
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === "chat" ? (
            <>
              <div
                className="border-b px-6 py-4"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
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
        <aside
          className="w-96 border-l p-4 hidden lg:flex flex-col gap-4 overflow-y-auto"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <h2 className="font-medium text-xs tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            Knowledge Graph
          </h2>
          <GraphVisualization key={graphKey} />
          <StatusBar />
        </aside>
      </div>
    </main>
  );
}

function LandingPage({ onEnter }: { onEnter: () => void }) {
  const features = [
    {
      icon: "~",
      title: "Graph-Enhanced RAG",
      desc: "Neo4j knowledge graph with LLM-guided entity extraction and multi-hop traversal for 38% better recall.",
    },
    {
      icon: ">",
      title: "LangGraph Workflow",
      desc: "Orchestrated pipeline: entity extraction, graph retrieval, chunk retrieval, and answer generation.",
    },
    {
      icon: "#",
      title: "Chunking Comparison",
      desc: "Evaluate fixed, semantic, and late chunking strategies across faithfulness, recall, and relevancy.",
    },
    {
      icon: "*",
      title: "Full Observability",
      desc: "Langfuse tracing on every query. See token usage, latency, and retrieval quality in real-time.",
    },
  ];

  const techStack = [
    { name: "LangGraph", category: "Orchestration" },
    { name: "Neo4j", category: "Graph DB" },
    { name: "FastAPI", category: "Backend" },
    { name: "Next.js", category: "Frontend" },
    { name: "OpenAI / Gemini", category: "LLM" },
    { name: "Langfuse", category: "Observability" },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="animate-fade-in text-center max-w-3xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--success)" }}
            />
            Portfolio Project
          </div>

          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
            <span className="gradient-text">Graph RAG</span>
            <br />
            <span style={{ color: "var(--text-primary)" }}>Knowledge Assistant</span>
          </h1>

          <p
            className="text-lg max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Query financial filings with graph-enhanced retrieval.
            Entity extraction, multi-hop traversal, and chunking strategy
            evaluation — all in one pipeline.
          </p>

          <button
            onClick={onEnter}
            className="px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 animate-glow"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Launch App
          </button>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-20 max-w-3xl w-full">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl p-5 border transition-all duration-200 animate-fade-in"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border-subtle)",
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-mono mb-3"
                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
              >
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="mt-16 text-center">
          <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Built with
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map((t) => (
              <div
                key={t.name}
                className="px-3 py-2 rounded-lg border text-xs"
                style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-subtle)" }}
              >
                <span style={{ color: "var(--text-primary)" }}>{t.name}</span>
                <span className="ml-1" style={{ color: "var(--text-muted)" }}>
                  {t.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs" style={{ color: "var(--text-muted)" }}>
        Graph RAG Knowledge Assistant — Ankit Patil
      </footer>
    </div>
  );
}
