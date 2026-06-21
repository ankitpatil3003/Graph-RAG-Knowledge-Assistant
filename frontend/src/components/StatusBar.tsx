"use client";

import { useEffect, useState } from "react";
import { getHealth, HealthResponse } from "@/lib/api";

export function StatusBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  if (!health) {
    return (
      <div className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Backend not connected
      </div>
    );
  }

  const { services } = health;

  return (
    <div className="mt-auto pt-4 space-y-3">
      <h3
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        Services
      </h3>
      <div className="space-y-2">
        <StatusDot label="Neo4j" status={services.neo4j} />
        <StatusDot label="Langfuse" status={services.langfuse} />
        <StatusDot
          label={`LLM (${services.llm.provider})`}
          status="connected"
        />
      </div>
      <div
        className="rounded-lg p-2.5 text-xs border"
        style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-subtle)" }}
      >
        <span style={{ color: "var(--text-muted)" }}>Model: </span>
        <span style={{ color: "var(--text-primary)" }}>{services.llm.model}</span>
        {services.llm.is_free_tier && (
          <span
            className="ml-2 px-1.5 py-0.5 rounded text-xs"
            style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
          >
            free
          </span>
        )}
      </div>
    </div>
  );
}

function StatusDot({ label, status }: { label: string; status: string }) {
  const isOk = status === "connected";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: isOk ? "var(--success)" : "var(--warning)" }}
      />
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-muted)" }}>{status}</span>
    </div>
  );
}
