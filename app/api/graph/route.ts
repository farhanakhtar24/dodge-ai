import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const NODE_COLORS: Record<string, string> = {
  SalesOrder:   "#3B82F6",
  SOItem:       "#93C5FD",
  Delivery:     "#10B981",
  DeliveryItem: "#6EE7B7",
  BillingDoc:   "#F59E0B",
  BillingItem:  "#FCD34D",
  Cancellation: "#F97316",
  JournalEntry: "#06B6D4",
  Payment:      "#8B5CF6",
  Customer:     "#EF4444",
  Product:      "#EC4899",
  Plant:        "#84CC16",
  Address:      "#6B7280",
};

const TYPE_TO_TABLE: Record<string, { table: string; idCol: string; labelCol?: string }> = {
  SalesOrder:   { table: "sales_order_headers",   idCol: "salesOrder" },
  Delivery:     { table: "outbound_delivery_headers", idCol: "deliveryDocument" },
  BillingDoc:   { table: "billing_document_headers",  idCol: "billingDocument" },
  Cancellation: { table: "billing_document_cancellations", idCol: "billingDocument" },
  JournalEntry: { table: "journal_entry_items",    idCol: "accountingDocument" },
  Payment:      { table: "payments",               idCol: "accountingDocument" },
  Customer:     { table: "business_partners",      idCol: "businessPartner", labelCol: "businessPartnerFullName" },
  Product:      { table: "products",               idCol: "product" },
  Plant:        { table: "plants",                 idCol: "plant", labelCol: "plantName" },
};

// Default types shown (core O2C flow)
const DEFAULT_TYPES = ["SalesOrder", "Delivery", "BillingDoc", "Payment", "JournalEntry"];

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "600");
  const typesParam = searchParams.get("types");
  const activeTypes = typesParam ? typesParam.split(",") : DEFAULT_TYPES;

  const nodes: Record<string, unknown>[] = [];
  const nodeIds = new Set<string>();

  // Load nodes for each active type
  for (const type of activeTypes) {
    const meta = TYPE_TO_TABLE[type];
    if (!meta) continue;
    try {
      const rows = db.prepare(`SELECT * FROM ${meta.table} LIMIT ?`).all(limit) as Record<string, unknown>[];
      for (const row of rows) {
        const id = row[meta.idCol] as string;
        if (!id || nodeIds.has(id)) continue;
        nodeIds.add(id);
        nodes.push({
          id,
          label: (meta.labelCol ? row[meta.labelCol] : id) as string || id,
          type,
          color: NODE_COLORS[type] || "#6B7280",
          details: row,
        });
      }
    } catch {
      // table may be empty
    }
  }

  // Enforce node limit
  const limitedNodes = nodes.slice(0, limit);
  const limitedIds = new Set(limitedNodes.map((n) => n.id as string));

  // Load edges between included nodes only
  const edgeRows = db.prepare("SELECT * FROM edges").all() as {
    source_id: string; source_type: string;
    target_id: string; target_type: string;
    relationship_label: string;
  }[];

  const links = edgeRows
    .filter((e) => limitedIds.has(e.source_id) && limitedIds.has(e.target_id))
    .map((e) => ({ source: e.source_id, target: e.target_id, label: e.relationship_label }));

  // Compute node degree for sizing
  const degree: Record<string, number> = {};
  for (const link of links) {
    degree[link.source as string] = (degree[link.source as string] || 0) + 1;
    degree[link.target as string] = (degree[link.target as string] || 0) + 1;
  }
  for (const node of limitedNodes) {
    node.val = Math.max(2, Math.min(20, (degree[node.id as string] || 0) + 2));
  }

  return NextResponse.json({ nodes: limitedNodes, links });
}
