"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getGraph, GraphData, GraphNode, GraphEdge } from "@/lib/api";

const TYPE_COLORS: Record<string, string> = {
  COMPANY: "#6366f1",
  PERSON: "#a78bfa",
  METRIC: "#22c55e",
  DATE: "#f59e0b",
  LOCATION: "#ef4444",
  PRODUCT: "#06b6d4",
  REGULATION: "#ec4899",
  Document: "#4b5563",
  Unknown: "#6b7280",
};

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function GraphVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);

  // Zoom & pan state
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGraph(200);
      setGraphData(data);
      setError(null);

      nodesRef.current = data.nodes.map((n, i) => ({
        ...n,
        x: 200 + Math.cos((i / data.nodes.length) * Math.PI * 2) * 120,
        y: 175 + Math.sin((i / data.nodes.length) * Math.PI * 2) * 100,
        vx: 0,
        vy: 0,
      }));
      edgesRef.current = data.edges;
      scaleRef.current = 1;
      panRef.current = { x: 0, y: 0 };
    } catch {
      setError("Could not load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Force simulation + render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData || graphData.nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    function tick() {
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 800 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction
      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 80) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center gravity + damping
      for (const node of nodes) {
        node.vx += (W / 2 - node.x) * 0.001;
        node.vy += (H / 2 - node.y) * 0.001;
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(20, Math.min(W - 20, node.x));
        node.y = Math.max(20, Math.min(H - 20, node.y));
      }

      // Draw
      const scale = scaleRef.current;
      const pan = panRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(scale, scale);

      // Edges with glow
      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Nodes
      for (const node of nodes) {
        const color = TYPE_COLORS[node.type] || TYPE_COLORS.Unknown;
        const isHovered = hoveredNode?.id === node.id;
        const radius = node.type === "Document" ? 7 : isHovered ? 7 : 5;

        // Glow for hovered
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
          ctx.fillStyle = color + "30";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.fillStyle = "rgba(232, 232, 240, 0.6)";
        ctx.font = "8px system-ui";
        ctx.textAlign = "center";
        const label =
          node.label.length > 15 ? node.label.slice(0, 14) + "…" : node.label;
        ctx.fillText(label, node.x, node.y + radius + 11);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [graphData, hoveredNode]);

  // Hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scale = scaleRef.current;
      const pan = panRef.current;
      const mx = (e.clientX - rect.left - pan.x) / scale;
      const my = (e.clientY - rect.top - pan.y) / scale;

      if (draggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        panRef.current = { x: pan.x + dx, y: pan.y + dy };
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const found = nodesRef.current.find((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        return dx * dx + dy * dy < 100;
      });
      setHoveredNode(found || null);
    },
    []
  );

  // Zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scaleRef.current = Math.max(0.3, Math.min(3, scaleRef.current * delta));
  }, []);

  // Pan with drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  if (loading) {
    return (
      <div
        className="h-64 flex items-center justify-center text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <div
          className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full mr-2"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
        Loading graph...
      </div>
    );
  }

  if (error || !graphData || graphData.nodes.length === 0) {
    return (
      <div
        className="h-64 flex flex-col items-center justify-center text-xs gap-2"
        style={{ color: "var(--text-muted)" }}
      >
        <p>{error || "No entities in graph yet"}</p>
        <p>Upload a PDF to populate the knowledge graph</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {graphData.nodes.length} nodes &middot; {graphData.edges.length} edges
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            scroll to zoom
          </span>
          <button
            onClick={fetchGraph}
            className="text-xs px-2 py-1 rounded-md transition-colors"
            style={{ color: "var(--accent)", background: "var(--accent-dim)" }}
          >
            Refresh
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={350}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full rounded-xl border cursor-grab active:cursor-grabbing"
        style={{
          height: "350px",
          background: "var(--bg-tertiary)",
          borderColor: "var(--border-subtle)",
        }}
      />

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="rounded-lg p-2.5 text-xs border animate-fade-in"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            {hoveredNode.label}
          </p>
          <p style={{ color: "var(--text-muted)" }}>{hoveredNode.type}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(TYPE_COLORS)
          .filter(([type]) => type !== "Unknown")
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: color }}
              />
              {type}
            </div>
          ))}
      </div>
    </div>
  );
}
