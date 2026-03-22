import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { SCHEMA_FOR_LLM } from "./schema";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const MODEL = groq("llama-3.3-70b-versatile");

export const SYSTEM_PROMPT = `You are an expert data analyst for an SAP Order-to-Cash system.
You have access to a SQLite database with the following schema:

${SCHEMA_FOR_LLM}

RULES:
- Only generate SELECT statements. Never INSERT, UPDATE, DELETE, or DROP.
- Use valid SQLite syntax only.
- Limit results to 100 rows unless the user specifies otherwise.
- Use proper JOINs based on the key relationships defined in the schema.
- Be concise and data-driven in your answers.
- At the end of your answer, include a JSON object listing any specific entity IDs mentioned in results: {"referencedIds": ["id1", "id2"]}

DOMAIN HINTS:
- Full O2C trace: billing_document_headers → billing_document_items → outbound_delivery_headers (referenceSdDocument) → sales_order_headers → payments (invoiceReference)
- Unbilled deliveries: outbound_delivery_headers LEFT JOIN billing_document_items ON deliveryDocument = referenceSdDocument WHERE billing side IS NULL
- Unpaid invoices: billing_document_headers LEFT JOIN payments ON billingDocument = invoiceReference WHERE payments side IS NULL
- Products with most billing docs: JOIN billing_document_items with products on material = product, GROUP BY product

This system is ONLY for Order-to-Cash data analysis. Reject unrelated queries politely.`;

const OFF_TOPIC = [
  /\bpoe[mt]/i, /\blyric/i, /\bsong\b/i,
  /\bhistory\b(?! of (order|invoice|billing|delivery|payment|sales))/i,
  /\bjavascript\b/i, /\bpython\b/i, /\brecipe/i,
  /\bweather/i, /\bsport/i, /\bmovie/i, /\bfilm\b/i, /\bcook/i, /\bjoke\b/i,
];

export function isOffTopic(message: string): boolean {
  return OFF_TOPIC.some((p) => p.test(message));
}

const SQL_SYSTEM = `You are a SQLite expert for an SAP Order-to-Cash database. Output ONLY a raw SQL SELECT statement — no markdown, no backticks, no explanation, no trailing semicolons.

${SCHEMA_FOR_LLM}

VERIFIED WORKING JOIN CONDITIONS (use EXACTLY these — others return 0 rows):
- Products in billing docs:     billing_document_items b JOIN products p ON b.material = p.product
- Billing docs for a delivery:  billing_document_items b JOIN outbound_delivery_headers d ON b.referenceSdDocument = d.deliveryDocument
- Delivery for a sales order:   outbound_delivery_items d JOIN sales_order_headers s ON d.referenceSdDocument = s.salesOrder  (single key only — do NOT add item-level condition)
- Payment for a billing doc:    payments p JOIN billing_document_headers b ON p.invoiceReference = b.billingDocument
- Journal for a billing doc:    journal_entry_items j JOIN billing_document_headers b ON j.referenceDocument = b.billingDocument
- Customer for a sales order:   sales_order_headers s JOIN business_partners bp ON s.soldToParty = bp.businessPartner

TRACE QUERY TEMPLATE — use this EXACT pattern when asked to trace a billing document:
SELECT
  bdh.billingDocument,
  bdh.billingDocumentDate,
  bdh.totalNetAmount        AS billingAmount,
  bdh.transactionCurrency,
  bdi.material,
  odh.deliveryDocument,
  odh.actualGoodsMovementDate,
  odi.referenceSdDocument   AS salesOrder,
  soh.salesOrderType,
  soh.soldToParty,
  soh.totalNetAmount        AS orderAmount,
  p.amountInTransactionCurrency AS paymentAmount,
  p.clearingDate,
  j.accountingDocument,
  j.postingDate
FROM billing_document_headers bdh
LEFT JOIN billing_document_items bdi ON bdh.billingDocument = bdi.billingDocument
LEFT JOIN outbound_delivery_headers odh ON bdi.referenceSdDocument = odh.deliveryDocument
LEFT JOIN outbound_delivery_items odi ON odh.deliveryDocument = odi.deliveryDocument
LEFT JOIN sales_order_headers soh ON odi.referenceSdDocument = soh.salesOrder
LEFT JOIN payments p ON bdh.billingDocument = p.invoiceReference
LEFT JOIN journal_entry_items j ON bdh.billingDocument = j.referenceDocument
WHERE bdh.billingDocument = '[ID]'

RULES:
- NEVER join on both referenceSdDocument AND referenceSdDocumentItem together — it always returns 0 rows
- For trace queries ALWAYS use LEFT JOINs (never INNER JOIN) so partial flows still return rows
- Always use the most direct join path. Do not chain through intermediate tables unless tracing the full O2C flow
- Use COUNT(), GROUP BY, ORDER BY, LIMIT appropriately`;

function cleanSQL(raw: string): string {
  return raw
    .trim()
    .replace(/^```sql\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .replace(/;$/, "")
    .trim();
}

export async function generateSQL(question: string): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    system: SQL_SYSTEM,
    prompt: `Generate a SQL SELECT query for: ${question}`,
  });
  const sql = cleanSQL(text);
  if (!sql.toUpperCase().startsWith("SELECT")) {
    throw new Error("Model generated a non-SELECT query — blocked.");
  }
  return sql;
}

export async function fixSQL(originalSQL: string, question: string): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    system: SQL_SYSTEM,
    prompt: `This SQL returned 0 rows for the question "${question}":
${originalSQL}

The query may be using wrong join paths or wrong column names. Rewrite it using the PREFERRED JOIN PATHS above. Output ONLY the corrected raw SQL SELECT statement.`,
  });
  return cleanSQL(text);
}
