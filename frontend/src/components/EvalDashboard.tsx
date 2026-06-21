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
  fixed: "#3b82f6",
  semantic: "#8b5cf6",
  late: "#10b981",
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">RAGAS Evaluation</h2>
        <button
          onClick={handleRunAll}
          disabled={loading}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Running..." : "Run Full Evaluation"}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Compares fixed, semantic, and late chunking strategies across
        faithfulness, context recall, and answer relevancy.
      </p>

      {loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full" />
            <div>
              <p className="font-medium">Evaluation in progress...</p>
              <p className="text-yellow-600 text-xs mt-1">
                Running 15 queries x 3 strategies. This may take a few minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
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
    <div className="space-y-6">
      {/* Comparison Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Metric
              </th>
              {strategies.map((s) => (
                <th key={s.strategy} className="text-center px-4 py-3">
                  <span
                    className="inline-block px-2 py-1 rounded text-xs font-semibold text-white"
                    style={{
                      backgroundColor:
                        STRATEGY_COLORS[s.strategy] || "#6b7280",
                    }}
                  >
                    {s.strategy}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => {
              const best = data.best_by_metric?.[metric];
              return (
                <tr key={metric} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {METRIC_LABELS[metric] || metric}
                  </td>
                  {strategies.map((s) => {
                    const score = s.scores[metric];
                    const isBest = best?.strategy === s.strategy;
                    const numScore =
                      typeof score === "number" ? score : null;

                    return (
                      <td key={s.strategy} className="text-center px-4 py-3">
                        {numScore !== null ? (
                          <div className="space-y-1">
                            <span
                              className={`text-lg font-semibold ${
                                isBest ? "text-green-600" : "text-gray-700"
                              }`}
                            >
                              {(numScore * 100).toFixed(1)}%
                              {isBest && (
                                <span className="ml-1 text-xs">★</span>
                              )}
                            </span>
                            {/* Score bar */}
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${numScore * 100}%`,
                                  backgroundColor:
                                    STRATEGY_COLORS[s.strategy] || "#6b7280",
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">
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
      {data.best_by_metric &&
        Object.keys(data.best_by_metric).length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-800 mb-2">
              Best Strategy by Metric
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(data.best_by_metric).map(([metric, info]) => (
                <div key={metric} className="text-center">
                  <p className="text-xs text-green-600">
                    {METRIC_LABELS[metric] || metric}
                  </p>
                  <p className="font-semibold text-green-800">
                    {info.strategy}
                  </p>
                  <p className="text-xs text-green-600">
                    {(info.score * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Questions evaluated */}
      <p className="text-xs text-gray-400 text-center">
        Evaluated {strategies[0]?.num_questions || 0} questions per strategy
      </p>
    </div>
  );
}
