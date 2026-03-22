"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods } from "react-force-graph-2d";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
  val: number;
  details: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface Props {
  data: GraphData;
  highlightNodeIds: Set<string>;
  selectedNodeId?: string | null;
  onNodeClick: (node: GraphNode) => void;
}

const ALL_TYPES = [
  "SalesOrder", "Delivery", "BillingDoc", "Payment",
  "JournalEntry", "Customer", "Product", "Plant", "Cancellation",
];

const TYPE_LABELS: Record<string, string> = {
  SalesOrder: "Sales Order", Delivery: "Delivery", BillingDoc: "Billing",
  Payment: "Payment", JournalEntry: "Journal", Customer: "Customer",
  Product: "Product", Plant: "Plant", Cancellation: "Cancellation",
};

const TYPE_COLORS: Record<string, string> = {
  SalesOrder: "#3B82F6", Delivery: "#10B981", BillingDoc: "#F59E0B",
  Payment: "#8B5CF6", JournalEntry: "#06B6D4", Customer: "#EF4444",
  Product: "#EC4899", Plant: "#84CC16", Cancellation: "#F97316",
};

export default function GraphExplorer({ data, highlightNodeIds, selectedNodeId, onNodeClick }: Props) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(["SalesOrder", "Delivery", "BillingDoc", "Payment", "JournalEntry", "Customer", "Cancellation"])
  );

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const graphData = useMemo(() => {
    const nodes = data.nodes.filter((n) => activeTypes.has(n.type));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = data.links.filter((l) => {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const t = typeof l.target === "string" ? l.target : l.target.id;
      return nodeIds.has(s) && nodeIds.has(t);
    });
    return { nodes, links };
  }, [data, activeTypes]);

  // Tune forces after graphData is defined
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fg.d3Force("charge") as any)?.strength(-180);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fg.d3Force("link") as any)?.distance(55).strength(0.5);
    // Register collision force to prevent node overlap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { forceCollide } = require("d3-force-3d") as any;
    fg.d3Force("collide", forceCollide(14).strength(0.8));
    fg.d3ReheatSimulation();
  }, [graphData]);

  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(400, 40);
  }, []);

  const handleNodeClick = useCallback((node: object) => {
    onNodeClick(node as GraphNode);
  }, [onNodeClick]);

  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode & { x: number; y: number };
      const r = Math.sqrt(n.val || 2) * 2;
      const isHighlighted = highlightNodeIds.has(n.id);
      const isSelected = selectedNodeId === n.id;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);

      if (isSelected) {
        ctx.fillStyle = n.color || "#3B82F6";
        ctx.fill();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = isHighlighted ? "#f59e0b" : (n.color || "#6B7280");
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    [highlightNodeIds, selectedNodeId]
  );

  return (
    <div className="relative h-full bg-gray-50">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeId="id"
        nodeLabel={(n) => `${(n as GraphNode).type}: ${(n as GraphNode).label}`}
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => "replace"}
        onNodeClick={handleNodeClick}
        linkLabel={(l) => (l as GraphLink).label}
        linkColor={(link) => {
          const l = link as GraphLink;
          const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
          const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
          return selectedNodeId && (s === selectedNodeId || t === selectedNodeId)
            ? "rgba(59,130,246,0.8)"
            : "rgba(148,163,184,0.3)";
        }}
        linkWidth={(link) => {
          const l = link as GraphLink;
          const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
          const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
          return selectedNodeId && (s === selectedNodeId || t === selectedNodeId) ? 2 : 1;
        }}
        linkDirectionalArrowLength={0}
        onEngineStop={handleEngineStop}
        warmupTicks={80}
        cooldownTicks={300}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.35}
        backgroundColor="#f9fafb"
        width={undefined}
        height={undefined}
      />

      {/* Type filter pills — top right */}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap gap-1 justify-end max-w-sm">
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all ${
              activeTypes.has(type)
                ? "bg-white/90 border-gray-300 text-gray-700 shadow-sm"
                : "bg-white/50 border-gray-200 text-gray-400"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: activeTypes.has(type) ? TYPE_COLORS[type] : "#d1d5db" }}
            />
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Node / edge count — bottom left */}
      <div className="absolute bottom-3 left-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded-md border border-gray-100">
        {graphData.nodes.length} nodes · {graphData.links.length} edges
      </div>
    </div>
  );
}
