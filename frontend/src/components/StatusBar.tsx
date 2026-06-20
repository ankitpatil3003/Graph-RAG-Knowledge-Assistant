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
      <div className="mt-4 text-xs text-gray-400">
        Backend not connected
      </div>
    );
  }

  const { services } = health;

  return (
    <div className="mt-4 space-y-2 text-xs">
      <h3 className="font-medium text-gray-500">Services</h3>
      <div className="space-y-1">
        <StatusDot label="Neo4j" status={services.neo4j} />
        <StatusDot label="Langfuse" status={services.langfuse} />
        <StatusDot
          label={`LLM (${services.llm.provider})`}
          status="connected"
        />
      </div>
      <p className="text-gray-400">
        Model: {services.llm.model}
        {services.llm.is_free_tier && " — free tier"}
      </p>
    </div>
  );
}

function StatusDot({ label, status }: { label: string; status: string }) {
  const isOk = status === "connected";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full ${isOk ? "bg-green-500" : "bg-yellow-500"}`}
      />
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-400">{status}</span>
    </div>
  );
}
