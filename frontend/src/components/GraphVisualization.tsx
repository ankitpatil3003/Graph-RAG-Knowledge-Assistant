"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getGraph, GraphData, GraphNode, GraphEdge } from "@/lib/api";

// Color map for node types
const TYPE_COLORS: Record<string, string> = {
  COMPANY: "#3b82f6",
  PERSON: "#8b5cf6",
  METRIC: "#10b981",
  DATE: "#f59e0b",
  LOCATION: "#ef4444",
  PRODUCT: "#06b6d4",
  REGULATION: "#ec4899",
  Document: "#6b7280",
  Unknown: "#9ca3af",
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

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGraph(200);
      setGraphData(data);
      setError(null);

      // Initialize positions
      nodesRef.current = data.nodes.map((n, i) => ({
        ...n,
        x: 200 + Math.cos((i / data.nodes.length) * Math.PI * 2) * 120,
        y: 150 + Math.sin((i / data.nodes.length) * Math.PI * 2) * 100,
        vx: 0,
        vy: 0,
      }));
      edgesRef.current = data.edges;
    } catch {
      setError("Could not load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Simple force simulation + render loop
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
      // Repulsion between nodes
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

      // Attraction along edges
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

      // Center gravity
      for (const node of nodes) {
        node.vx += (W / 2 - node.x) * 0.001;
        node.vy += (H / 2 - node.y) * 0.001;
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        // Clamp
        node.x = Math.max(20, Math.min(W - 20, node.x));
        node.y = Math.max(20, Math.min(H - 20, node.y));
      }

      // Draw
      ctx.clearRect(0, 0, W, H);

      // Edges
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes
      for (const node of nodes) {
        const color = TYPE_COLORS[node.type] || TYPE_COLORS.Unknown;
        const radius = node.type === "Document" ? 8 : 6;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = "#374151";
        ctx.font = "9px system-ui";
        ctx.textAlign = "center";
        const label =
          node.label.length > 15
            ? node.label.slice(0, 14) + "…"
            : node.label;
        ctx.fillText(label, node.x, node.y + radius + 12);
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [graphData]);

  // Hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const found = nodesRef.current.find((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        return dx * dx + dy * dy < 100;
      });
      setHoveredNode(found || null);
    },
    []
  );

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-400">
        Loading graph...
      </div>
    );
  }

  if (error || !graphData || graphData.nodes.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-sm text-gray-400 gap-2">
        <p>{error || "No entities in graph yet"}</p>
        <p className="text-xs">Upload a PDF to populate the knowledge graph</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">
          {graphData.nodes.length} nodes · {graphData.edges.length} edges
        </span>
        <button
          onClick={fetchGraph}
          className="text-xs text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        onMouseMove={handleMouseMove}
        className="w-full rounded-lg border bg-white cursor-crosshair"
        style={{ height: "300px" }}
      />

      {/* Tooltip */}
      {hoveredNode && (
        <div className="bg-gray-800 text-white text-xs rounded p-2">
          <p className="font-medium">{hoveredNode.label}</p>
          <p className="text-gray-300">{hoveredNode.type}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_COLORS)
          .filter(([type]) => type !== "Unknown")
          .map(([type, color]) => (
            <div key={type} className="flex items-center gap-1 text-xs text-gray-500">
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
