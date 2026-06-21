"use client";

import { useState } from "react";
import {
  runEvaluation,
  EvalFullResult,
  EvalStrategyResult,
} from "@/lib/api";

const METRIC_LABELS: Record<string, string> = {
  faithfulness: "Faithfulness",
  answer_relevancy: "Answer Relevancy",
  context_recall: "Context Recall",
};

const STRATEGY_COLORS: Record<string, string> = {
  fixed: "#6366f1",
  semantic: "#a78bfa",
  late: "#22c55e",
};

export function EvalDashboard() {
  const [result, setResult] = useState<EvalFullResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRunAll() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = (await runEvaluation()) as EvalFullResult;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Chunking Strategy Evaluation
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Compares fixed, semantic, and late chunking across faithfulness, context recall, and answer relevancy.
          </p>
        </div>
        <button
          onClick={handleRunAll}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {loading ? "Running..." : "Run Evaluation"}
        </button>
      </div>

      {loading && (
        <div
          className="rounded-xl p-5 border"
          style={{
            background: "rgba(245, 158, 11, 0.05)",
            borderColor: "rgba(245, 158, 11, 0.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full"
              style={{ borderColor: "var(--warning)", borderTopColor: "transparent" }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--warning)" }}>
                Evaluation in progress...
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Running 15 queries x 3 strategies.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl p-4 text-sm border"
          style={{
            background: "rgba(239, 68, 68, 0.05)",
            borderColor: "rgba(239, 68, 68, 0.15)",
            color: "var(--error)",
          }}
        >
          {error}
        </div>
      )}

      {result && <EvalResults data={result} />}
    </div>
  );
}

function EvalResults({ data }: { data: EvalFullResult }) {
  const metrics = data.metrics || [];
  const strategies = data.strategies || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Comparison Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th
                className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Metric
              </th>
              {strategies.map((s) => (
                <th key={s.strategy} className="text-center px-5 py-3">
                  <span
                    className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold"
                    style={{
                      backgroundColor: STRATEGY_COLORS[s.strategy] || "#6b7280",
                      color: "#fff",
                    }}
                  >
                    {s.strategy}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, idx) => {
              const best = data.best_by_metric?.[metric];
              return (
                <tr
                  key={metric}
                  style={{
                    borderBottom: idx < metrics.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}
                >
                  <td className="px-5 py-4 font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                    {METRIC_LABELS[metric] || metric}
                  </td>
                  {strategies.map((s) => {
                    const score = s.scores[metric];
                    const isBest = best?.strategy === s.strategy;
                    const numScore = typeof score === "number" ? score : null;

                    return (
                      <td key={s.strategy} className="text-center px-5 py-4">
                        {numScore !== null ? (
                          <div className="space-y-2">
                            <span
                              className="text-lg font-bold"
                              style={{
                                color: isBest ? "var(--success)" : "var(--text-primary)",
                              }}
                            >
                              {(numScore * 100).toFixed(1)}%
                              {isBest && (
                                <span className="ml-1 text-xs" style={{ color: "var(--warning)" }}>
                                  *
                                </span>
                              )}
                            </span>
                            {/* Score bar */}
                            <div
                              className="w-full h-1.5 rounded-full overflow-hidden"
                              style={{ background: "var(--bg-tertiary)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${numScore * 100}%`,
                                  backgroundColor: STRATEGY_COLORS[s.strategy] || "#6b7280",
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {String(score || "N/A")}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Best Strategy Summary */}
      {data.best_by_metric && Object.keys(data.best_by_metric).length > 0 && (
        <div
          className="rounded-xl p-5 border"
          style={{
            background: "rgba(34, 197, 94, 0.05)",
            borderColor: "rgba(34, 197, 94, 0.15)",
          }}
        >
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--success)" }}
          >
            Best Strategy by Metric
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(data.best_by_metric).map(([metric, info]) => (
              <div key={metric} className="text-center">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {METRIC_LABELS[metric] || metric}
                </p>
                <p className="font-bold text-sm mt-1" style={{ color: "var(--text-primary)" }}>
                  {info.strategy}
                </p>
                <p className="text-xs" style={{ color: "var(--success)" }}>
                  {(info.score * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Evaluated {strategies[0]?.num_questions || 0} questions per strategy
      </p>
    </div>
  );
}
