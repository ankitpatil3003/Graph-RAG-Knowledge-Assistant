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
        <label className="text-gray-500">Chunking:</label>
        {(["fixed", "semantic", "late"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              strategy === s
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
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
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        {uploading ? (
          <div className="space-y-2">
            <div className="animate-spin mx-auto w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            <p className="text-sm text-gray-500">
              Parsing, extracting entities, building graph...
            </p>
          </div>
        ) : (
          <label className="cursor-pointer">
            <p className="text-sm text-gray-500">
              Drop a PDF here or{" "}
              <span className="text-blue-600 underline">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
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
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-green-800">Ingested: {result.filename}</p>
          <div className="mt-1 text-green-700 grid grid-cols-2 gap-x-4 text-xs">
            <span>{result.pages} pages</span>
            <span>{result.chunks} chunks ({result.chunking_strategy})</span>
            <span>{result.entities} entities</span>
            <span>{result.relationships} relationships</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
