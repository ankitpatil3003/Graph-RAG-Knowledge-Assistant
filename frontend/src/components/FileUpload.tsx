"use client";

import { useState, useCallback, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { ingestPDFs, getIngestStatus, IngestJob, IngestResponse } from "@/lib/api";

interface FileUploadProps {
  onIngested?: (result: IngestResponse) => void;
}

interface FileJob {
  filename: string;
  jobId?: string;
  status: "queued" | "processing" | "completed" | "failed";
  result?: IngestResponse | null;
  error?: string | null;
}

const POLL_INTERVAL = 1500;

export function FileUpload({ onIngested }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [strategy, setStrategy] = useState("fixed");
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Cleanup poll timers on unmount
  useEffect(() => {
    return () => {
      pollTimers.current.forEach((t) => clearInterval(t));
    };
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      if (pollTimers.current.has(jobId)) return;

      const timer = setInterval(async () => {
        try {
          const data: IngestJob = await getIngestStatus(jobId);

          setJobs((prev) =>
            prev.map((j) =>
              j.jobId === jobId
                ? { ...j, status: data.status, result: data.result, error: data.error }
                : j
            )
          );

          if (data.status === "completed" || data.status === "failed") {
            clearInterval(timer);
            pollTimers.current.delete(jobId);
            if (data.status === "completed" && data.result && onIngested) {
              onIngested(data.result);
            }
          }
        } catch {
          // Ignore transient fetch errors, keep polling
        }
      }, POLL_INTERVAL);

      pollTimers.current.set(jobId, timer);
    },
    [onIngested]
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const pdfs = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfs.length === 0) return;

      // Add pending entries
      const pending: FileJob[] = pdfs.map((f) => ({
        filename: f.name,
        status: "queued" as const,
      }));
      setJobs((prev) => [...pending, ...prev]);

      try {
        const res = await ingestPDFs(pdfs, strategy);

        // Update jobs with server-assigned IDs and start polling
        setJobs((prev) =>
          prev.map((j) => {
            const match = res.jobs.find(
              (r) => r.filename === j.filename && !j.jobId
            );
            if (match && match.job_id) {
              startPolling(match.job_id);
              return { ...j, jobId: match.job_id, status: (match.status as FileJob["status"]) || "queued" };
            }
            if (match && match.error) {
              return { ...j, status: "failed", error: match.error };
            }
            return j;
          })
        );
      } catch (err) {
        // Mark all pending as failed
        setJobs((prev) =>
          prev.map((j) =>
            !j.jobId && j.status === "queued"
              ? { ...j, status: "failed", error: err instanceof Error ? err.message : "Upload failed" }
              : j
          )
        );
      }
    },
    [strategy, startPolling]
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const activeCount = jobs.filter(
    (j) => j.status === "queued" || j.status === "processing"
  ).length;

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
        <label className="cursor-pointer">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Drop PDFs here or{" "}
            <span style={{ color: "var(--accent)" }}>browse</span>
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Select multiple files &middot; Financial filings (10-K, 10-Q, annual reports)
          </p>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={onFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Per-file job cards */}
      {jobs.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {activeCount > 0 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {activeCount} file{activeCount > 1 ? "s" : ""} processing...
            </p>
          )}
          {jobs.map((job, i) => (
            <JobCard key={job.jobId || `${job.filename}-${i}`} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: FileJob }) {
  const isActive = job.status === "queued" || job.status === "processing";
  const isDone = job.status === "completed";
  const isFailed = job.status === "failed";

  const borderColor = isDone
    ? "rgba(34, 197, 94, 0.2)"
    : isFailed
    ? "rgba(239, 68, 68, 0.2)"
    : "var(--border)";

  const bgColor = isDone
    ? "rgba(34, 197, 94, 0.08)"
    : isFailed
    ? "rgba(239, 68, 68, 0.08)"
    : "var(--bg-secondary)";

  return (
    <div
      className="rounded-lg p-3 text-xs border animate-fade-in"
      style={{ background: bgColor, borderColor }}
    >
      <div className="flex items-center gap-2">
        {/* Status icon */}
        {isActive && (
          <div
            className="animate-spin w-3.5 h-3.5 border-2 border-t-transparent rounded-full flex-shrink-0"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
        )}
        {isDone && (
          <span style={{ color: "var(--success)" }} className="flex-shrink-0">&#10003;</span>
        )}
        {isFailed && (
          <span style={{ color: "var(--error)" }} className="flex-shrink-0">&#10007;</span>
        )}

        {/* Filename + status label */}
        <span
          className="font-medium truncate"
          style={{
            color: isDone
              ? "var(--success)"
              : isFailed
              ? "var(--error)"
              : "var(--text-primary)",
          }}
        >
          {job.filename}
        </span>
        <span
          className="ml-auto flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {job.status === "queued" && "Queued"}
          {job.status === "processing" && "Ingesting..."}
          {job.status === "completed" && "Done"}
          {job.status === "failed" && "Failed"}
        </span>
      </div>

      {/* Result details */}
      {isDone && job.result && (
        <div
          className="mt-1.5 grid grid-cols-2 gap-x-4"
          style={{ color: "rgba(34, 197, 94, 0.7)" }}
        >
          <span>{job.result.pages} pages</span>
          <span>{job.result.chunks} chunks ({job.result.chunking_strategy})</span>
          <span>{job.result.entities} entities</span>
          <span>{job.result.relationships} relationships</span>
        </div>
      )}

      {/* Error message */}
      {isFailed && job.error && (
        <p className="mt-1" style={{ color: "var(--error)" }}>
          {job.error}
        </p>
      )}
    </div>
  );
}
