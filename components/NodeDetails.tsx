"use client";

import { X } from "lucide-react";
import type { GraphNode } from "./GraphExplorer";

interface Props {
  node: GraphNode | null;
  onClose: () => void;
  connectionCount: number;
}

const HIDDEN_FIELDS = new Set(["id", "label", "type", "color", "val", "x", "y", "vx", "vy", "index", "__indexColor"]);

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

export default function NodeDetails({ node, onClose, connectionCount }: Props) {
  if (!node) return null;

  const details = Object.entries(node.details || {}).filter(([k]) => !HIDDEN_FIELDS.has(k));

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-72 bg-white shadow-xl border border-gray-200 rounded-xl z-20 max-h-[70vh] flex flex-col">
      {/* Title */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-bold text-gray-900">{node.type}</h3>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-0.5">
        <p className="text-xs text-gray-700">
          <span className="font-medium">Entity:</span> {node.type}
        </p>
        {details.map(([key, val]) => (
          <p key={key} className="text-xs text-gray-700">
            <span className="font-medium">{key}:</span>{" "}
            <span className="text-gray-600">{formatValue(val)}</span>
          </p>
        ))}
        <p className="text-xs text-gray-400 italic pt-1">Additional fields hidden for readability</p>
      </div>

      {/* Connections */}
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-xs text-gray-700">
          <span className="font-medium">Connections:</span> {connectionCount}
        </p>
      </div>
    </div>
  );
}
