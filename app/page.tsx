"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import NodeDetails from "@/components/NodeDetails";
import ChatInterface from "@/components/ChatInterface";
import type { GraphData, GraphNode, GraphLink } from "@/components/GraphExplorer";
import { Layers, Minimize2, Maximize2 } from "lucide-react";

const GraphExplorer = dynamic(() => import("@/components/GraphExplorer"), { ssr: false });

export default function HomePage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightNodeIds, setHighlightNodeIds] = useState<Set<string>>(new Set());
  const [chatMinimized, setChatMinimized] = useState(false);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/graph?types=SalesOrder,Delivery,BillingDoc,Payment,JournalEntry,Customer,Product,Plant,Cancellation")
      .then((r) => r.json())
      .then((d: GraphData) => { setGraphData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setOverlayHidden(false);
  }, []);

  const handleReferencedIds = useCallback((ids: string[]) => {
    setHighlightNodeIds(new Set(ids));
    setTimeout(() => setHighlightNodeIds(new Set()), 8000);
  }, []);

  const connectionCount = selectedNode
    ? graphData.links.filter((l: GraphLink) => {
        const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
        const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
        return s === selectedNode.id || t === selectedNode.id;
      }).length
    : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2.5 bg-background border-b flex-shrink-0">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Mapping</span>
        <span className="text-xs text-muted-foreground/50">/</span>
        <span className="text-sm font-semibold">Order to Cash</span>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Graph panel */}
        <div className="relative flex-1 overflow-hidden min-w-0">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <button
              onClick={() => setChatMinimized((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
            >
              {chatMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              {chatMinimized ? "Show Chat" : "Minimize"}
            </button>
            <button
              onClick={() => setOverlayHidden((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
            >
              <Layers className="w-3.5 h-3.5" />
              {overlayHidden ? "Show Overlay" : "Hide Overlay"}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading graph data...
            </div>
          ) : (
            <GraphExplorer
              data={graphData}
              highlightNodeIds={highlightNodeIds}
              selectedNodeId={selectedNode?.id}
              onNodeClick={handleNodeClick}
            />
          )}

          {selectedNode && !overlayHidden && (
            <NodeDetails
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              connectionCount={connectionCount}
            />
          )}
        </div>

        {/* Chat panel — static 380px, hidden when minimized */}
        {!chatMinimized && (
          <div className="w-95 shrink-0 border-l h-full overflow-hidden">
            <ChatInterface onReferencedIds={handleReferencedIds} />
          </div>
        )}
      </div>
    </div>
  );
}
