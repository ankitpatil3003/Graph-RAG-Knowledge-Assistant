"use client";

import { useState, useCallback, DragEvent, ChangeEvent } from "react";
import { ingestPDF, IngestResponse } from "@/lib/api";

interface FileUploadProps {
  onIngested?: (result: IngestResponse) => void;
}

export function FileUpload({ onIngested }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [strategy, setStrategy] = useState("fixed");
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Only PDF files are supported");
        return;
      }

      setUploading(true);
      setError(null);
      setResult(null);

      try {
        const res = await ingestPDF(file, strategy);
        setResult(res);
        onIngested?.(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [strategy, onIngested]
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-3">
      {/* Strategy selector */}
      <div className="flex items-center gap-2 text-sm">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          Chunking:
        </label>
        {(["fixed", "semantic", "late"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200"
            style={{
              background: strategy === s ? "var(--accent-dim)" : "var(--bg-tertiary)",
              color: strategy === s ? "var(--accent)" : "var(--text-muted)",
              border: strategy === s ? "1px solid var(--accent)" : "1px solid transparent",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
        style={{
          borderColor: dragOver ? "var(--accent)" : "var(--border)",
          background: dragOver ? "var(--accent-dim)" : "transparent",
        }}
      >
        {uploading ? (
          <div className="space-y-2">
            <div
              className="animate-spin mx-auto w-5 h-5 border-2 border-t-transparent rounded-full"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Parsing, extracting entities, building graph...
            </p>
          </div>
        ) : (
          <label className="cursor-pointer">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Drop a PDF here or{" "}
              <span style={{ color: "var(--accent)" }}>browse</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Financial filings (10-K, 10-Q, annual reports)
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={onFileSelect}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Result */}
      {result && (
        <div
          className="rounded-lg p-3 text-xs border animate-fade-in"
          style={{
            background: "rgba(34, 197, 94, 0.08)",
            borderColor: "rgba(34, 197, 94, 0.2)",
          }}
        >
          <p className="font-medium" style={{ color: "var(--success)" }}>
            Ingested: {result.filename}
          </p>
          <div className="mt-1 grid grid-cols-2 gap-x-4" style={{ color: "rgba(34, 197, 94, 0.7)" }}>
            <span>{result.pages} pages</span>
            <span>{result.chunks} chunks ({result.chunking_strategy})</span>
            <span>{result.entities} entities</span>
            <span>{result.relationships} relationships</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-lg p-3 text-xs border"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            borderColor: "rgba(239, 68, 68, 0.2)",
            color: "var(--error)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
