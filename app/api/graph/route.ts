import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

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

// Note: Postgres lowercases unquoted column names, so idCol/labelCol are lowercase
const TYPE_TO_TABLE: Record<string, { table: string; idCol: string; labelCol?: string }> = {
  SalesOrder:   { table: "sales_order_headers",   idCol: "salesorder" },
  Delivery:     { table: "outbound_delivery_headers", idCol: "deliverydocument" },
  BillingDoc:   { table: "billing_document_headers",  idCol: "billingdocument" },
  Cancellation: { table: "billing_document_cancellations", idCol: "billingdocument" },
  JournalEntry: { table: "journal_entry_items",    idCol: "accountingdocument" },
  Payment:      { table: "payments",               idCol: "accountingdocument" },
  Customer:     { table: "business_partners",      idCol: "businesspartner", labelCol: "businesspartnerfullname" },
  Product:      { table: "products",               idCol: "product" },
  Plant:        { table: "plants",                 idCol: "plant", labelCol: "plantname" },
};

const DEFAULT_TYPES = ["SalesOrder", "Delivery", "BillingDoc", "Payment", "JournalEntry"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "600");
  const typesParam = searchParams.get("types");
  const activeTypes = typesParam ? typesParam.split(",") : DEFAULT_TYPES;

  const nodes: Record<string, unknown>[] = [];
  const nodeIds = new Set<string>();

  for (const type of activeTypes) {
    const meta = TYPE_TO_TABLE[type];
    if (!meta) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (sql as any)(`SELECT * FROM ${meta.table} LIMIT ${limit}`) as Record<string, unknown>[];
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

  const limitedNodes = nodes.slice(0, limit);
  const limitedIds = new Set(limitedNodes.map((n) => n.id as string));

  const edgeRows = await sql`SELECT * FROM edges` as {
    source_id: string; source_type: string;
    target_id: string; target_type: string;
    relationship_label: string;
  }[];

  const links = edgeRows
    .filter((e) => limitedIds.has(e.source_id) && limitedIds.has(e.target_id))
    .map((e) => ({ source: e.source_id, target: e.target_id, label: e.relationship_label }));

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
