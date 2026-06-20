"use client";

import { useState, FormEvent } from "react";
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
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg">Ask a question about financial filings</p>
            <p className="text-sm mt-2">
              e.g. &quot;What were Apple&apos;s revenue trends in 2024?&quot;
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-2xl rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.provider && (
                <p className="text-xs mt-2 opacity-60">
                  {msg.provider.model}
                  {msg.provider.is_free_tier && " (free tier)"}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-lg px-4 py-3 shadow-sm">
              <span className="animate-pulse text-gray-400">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t bg-white p-4">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about financial filings..."
            className="flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
