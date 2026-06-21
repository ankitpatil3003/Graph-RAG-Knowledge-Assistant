"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { queryRAG, QueryResponse } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  provider?: QueryResponse["provider"];
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await queryRAG(input);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          provider: result.provider,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-20 animate-fade-in">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
              style={{ background: "var(--accent-dim)" }}
            >
              <span style={{ color: "var(--accent)" }}>?</span>
            </div>
            <p className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
              Ask about financial filings
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              e.g. &quot;What was Horizon Fund II&apos;s annualized return?&quot;
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div
              className="max-w-2xl rounded-xl px-4 py-3 text-sm"
              style={{
                background:
                  msg.role === "user" ? "var(--accent)" : "var(--bg-card)",
                color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                border:
                  msg.role === "user" ? "none" : "1px solid var(--border-subtle)",
              }}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.provider && (
                <p className="text-xs mt-2 opacity-50">
                  {msg.provider.model}
                  {msg.provider.is_free_tier && " (free tier)"}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div
              className="rounded-xl px-4 py-3 border"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: "var(--accent)",
                      animationDelay: `${i * 200}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t p-4"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about financial filings..."
            className="flex-1 rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition-colors"
            style={{
              background: "var(--bg-tertiary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-30"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
