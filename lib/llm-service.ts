import { generateText } from "ai";
import { DEFAULT_MODEL } from "./models";

export const MODEL = DEFAULT_MODEL;

export const SYSTEM_PROMPT = `You are an expert data analyst for an SAP Order-to-Cash system. Answer questions using only data from the database. Be concise and data-driven. At the end of your answer include: {"referencedIds": ["id1","id2"]} listing any entity IDs from the results.`;

const OFF_TOPIC_REGEX = [
  /\bpoe[mt]/i, /\blyric/i, /\bsong\b/i,
  /\bhistory\b(?! of (order|invoice|billing|delivery|payment|sales))/i,
  /\bjavascript\b/i, /\bpython\b/i, /\brecipe/i,
  /\bweather/i, /\bsport/i, /\bmovie/i, /\bfilm\b/i, /\bcook/i, /\bjoke\b/i,
];

export async function isOffTopic(message: string): Promise<boolean> {
  // Fast path: obvious regex matches
  if (OFF_TOPIC_REGEX.some((p) => p.test(message))) return true;

  // LLM classification for anything not caught by regex
  const { text } = await generateText({
    model: MODEL,
    system: `You are a query classifier for an SAP Order-to-Cash business data system.
The system contains: sales orders, deliveries, billing documents, payments, journal entries, customers, products, and plants.
Reply with exactly one word — YES if the user's question is relevant to this business dataset, NO if it is not.
Do not explain. Do not add punctuation.`,
    prompt: message,
  });

  return text.trim().toUpperCase().startsWith("NO");
}

// ─── SQL System Prompt ────────────────────────────────────────────────────────
const SQL_SYSTEM = `You are a SQLite expert for an SAP Order-to-Cash database.
Output ONLY a raw SQL SELECT statement — no markdown, no backticks, no explanation, no trailing semicolons.
ALWAYS alias every table and prefix EVERY column with its alias to avoid ambiguous column errors.

━━━ TABLES & COLUMNS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

sales_order_headers (alias: soh)
  PK: salesOrder
  Columns: salesOrderType, salesOrganization, distributionChannel, soldToParty,
           totalNetAmount, transactionCurrency, overallDeliveryStatus,
           overallOrdReltdBillgStatus, creationDate, requestedDeliveryDate,
           headerBillingBlockReason, deliveryBlockReason, customerPaymentTerms
  Status codes: overallDeliveryStatus = 'C' (delivered), '' (not delivered)
                overallOrdReltdBillgStatus = 'C' (billed), '' (not billed)

sales_order_items (alias: soi)
  PK: salesOrder + salesOrderItem
  Columns: salesOrder, salesOrderItem, material, requestedQuantity,
           requestedQuantityUnit, netAmount, transactionCurrency,
           productionPlant, storageLocation

outbound_delivery_headers (alias: odh)
  PK: deliveryDocument
  Columns: deliveryDocument, creationDate, actualGoodsMovementDate,
           overallGoodsMovementStatus, overallPickingStatus, shippingPoint,
           deliveryBlockReason, headerBillingBlockReason

outbound_delivery_items (alias: odi)
  PK: deliveryDocument + deliveryDocumentItem
  Columns: deliveryDocument, deliveryDocumentItem, actualDeliveryQuantity,
           deliveryQuantityUnit, plant, storageLocation,
           referenceSdDocument, referenceSdDocumentItem
  ⚠️  referenceSdDocument = the sales order number

billing_document_headers (alias: bdh)
  PK: billingDocument
  Columns: billingDocument, billingDocumentType, billingDocumentDate,
           creationDate, totalNetAmount, transactionCurrency, companyCode,
           fiscalYear, accountingDocument, soldToParty,
           billingDocumentIsCancelled (INTEGER: 1=cancelled, 0=active),
           cancelledBillingDocument
  ⚠️  cancelledBillingDocument is always empty string — no re-billing data exists

billing_document_items (alias: bdi)
  PK: billingDocument + billingDocumentItem
  Columns: billingDocument, billingDocumentItem, material, billingQuantity,
           billingQuantityUnit, netAmount, transactionCurrency,
           referenceSdDocument, referenceSdDocumentItem
  ⚠️  referenceSdDocument = the delivery document number

billing_document_cancellations (alias: bdc)
  PK: billingDocument
  Columns: billingDocument, billingDocumentType, creationDate (= cancellation date),
           billingDocumentIsCancelled, cancelledBillingDocument, totalNetAmount,
           transactionCurrency, companyCode, fiscalYear, accountingDocument, soldToParty
  ⚠️  Does NOT have billingDocumentDate — use creationDate for the cancellation date

journal_entry_items (alias: j)
  PK: accountingDocument + accountingDocumentItem
  Columns: companyCode, fiscalYear, accountingDocument, accountingDocumentItem,
           glAccount, referenceDocument, amountInTransactionCurrency,
           transactionCurrency, companyCodeCurrency, amountInCompanyCodeCurrency,
           postingDate, documentDate, accountingDocumentType, customer

payments (alias: p)
  PK: accountingDocument + accountingDocumentItem
  Columns: companyCode, fiscalYear, accountingDocument, accountingDocumentItem,
           clearingDate, amountInTransactionCurrency, transactionCurrency,
           companyCodeCurrency, amountInCompanyCodeCurrency, customer,
           invoiceReference, invoiceReferenceFiscalYear, salesDocument,
           postingDate, documentDate, glAccount
  ⚠️  invoiceReference is NULL for ALL records — payments cannot be linked to
      billing documents in this dataset. Do not attempt payment-to-billing joins.

business_partners (alias: bp)
  PK: businessPartner
  Columns: businessPartner, customer, businessPartnerFullName,
           businessPartnerCategory, businessPartnerName, creationDate,
           businessPartnerIsBlocked (BOOLEAN), isMarkedForArchiving (BOOLEAN)

business_partner_addresses (alias: bpa)
  PK: businessPartner + addressId
  Columns: businessPartner, addressId, cityName, country, postalCode,
           streetName, region, addressTimeZone

products (alias: prod)
  PK: product
  Columns: product, productType, grossWeight, netWeight, weightUnit,
           baseUnit, productGroup, isMarkedForDeletion (BOOLEAN), creationDate

product_descriptions (alias: pd)
  PK: product + language
  Columns: product, language, productDescription

plants (alias: pl)
  PK: plant
  Columns: plant, plantName, salesOrganization, distributionChannel,
           addressId, plantCategory

product_plants (alias: pp)
  PK: product + plant
  Columns: product, plant, countryOfOrigin, profitCenter, mrpType

━━━ VERIFIED JOIN PATHS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Sales order → delivery
outbound_delivery_items odi ON odi.referenceSdDocument = soh.salesOrder
⚠️  Single key ONLY — never add referenceSdDocumentItem condition (always returns 0)

-- Delivery → billing
billing_document_items bdi ON bdi.referenceSdDocument = odi.deliveryDocument

-- Billing item → billing header
billing_document_headers bdh ON bdh.billingDocument = bdi.billingDocument

-- Billing → journal entry
journal_entry_items j ON j.referenceDocument = bdh.billingDocument

-- Products in billing
billing_document_items bdi JOIN products prod ON prod.product = bdi.material

-- Products with descriptions
products prod JOIN product_descriptions pd ON pd.product = prod.product AND pd.language = 'EN'

-- Customer for sales order
sales_order_headers soh JOIN business_partners bp ON bp.businessPartner = soh.soldToParty

-- Cancellation date range
billing_document_cancellations bdc JOIN billing_document_headers bdh ON bdh.billingDocument = bdc.billingDocument
  Date diff: CAST(julianday(bdc.creationDate) - julianday(bdh.billingDocumentDate) AS INTEGER)

━━━ QUERY TEMPLATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- TRACE full O2C flow for a billing document (always LEFT JOIN):
SELECT bdh.billingDocument, bdh.billingDocumentDate, bdh.totalNetAmount,
       bdh.transactionCurrency, bdi.material,
       odh.deliveryDocument, odh.actualGoodsMovementDate,
       odi.referenceSdDocument AS salesOrder,
       soh.salesOrderType, soh.soldToParty, soh.totalNetAmount AS orderAmount,
       j.accountingDocument, j.postingDate
FROM billing_document_headers bdh
LEFT JOIN billing_document_items bdi ON bdi.billingDocument = bdh.billingDocument
LEFT JOIN outbound_delivery_headers odh ON odh.deliveryDocument = bdi.referenceSdDocument
LEFT JOIN outbound_delivery_items odi ON odi.deliveryDocument = odh.deliveryDocument
LEFT JOIN sales_order_headers soh ON soh.salesOrder = odi.referenceSdDocument
LEFT JOIN journal_entry_items j ON j.referenceDocument = bdh.billingDocument
WHERE bdh.billingDocument = '[ID]'

-- BILLING DOCS for a sales order (always LEFT JOIN):
SELECT soh.salesOrder, soh.overallDeliveryStatus, soh.overallOrdReltdBillgStatus,
       odi.deliveryDocument, bdh.billingDocument, bdh.billingDocumentDate,
       bdh.totalNetAmount, bdh.transactionCurrency
FROM sales_order_headers soh
LEFT JOIN outbound_delivery_items odi ON odi.referenceSdDocument = soh.salesOrder
LEFT JOIN billing_document_items bdi ON bdi.referenceSdDocument = odi.deliveryDocument
LEFT JOIN billing_document_headers bdh ON bdh.billingDocument = bdi.billingDocument
WHERE soh.salesOrder = '[ID]'

-- UNDELIVERED sales orders:
SELECT soh.salesOrder, soh.totalNetAmount, soh.transactionCurrency, soh.creationDate
FROM sales_order_headers soh
LEFT JOIN outbound_delivery_items odi ON odi.referenceSdDocument = soh.salesOrder
WHERE odi.referenceSdDocument IS NULL

-- UNBILLED deliveries (delivered but no billing doc):
SELECT odh.deliveryDocument, odh.actualGoodsMovementDate
FROM outbound_delivery_headers odh
LEFT JOIN billing_document_items bdi ON bdi.referenceSdDocument = odh.deliveryDocument
WHERE bdi.referenceSdDocument IS NULL

-- ACTIVE (non-cancelled) billing documents:
WHERE bdh.billingDocumentIsCancelled = 0

━━━ RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ALWAYS alias every table. ALWAYS prefix every column with its alias.
2. NEVER join on both referenceSdDocument AND referenceSdDocumentItem — always 0 rows.
3. Use LEFT JOINs for any "show what exists" or trace query.
4. NULL check after LEFT JOIN: use IS NULL on the JOIN KEY column only.
5. Date arithmetic: use julianday() — e.g. CAST(julianday(a) - julianday(b) AS INTEGER).
6. payments.invoiceReference is always NULL — payments cannot be linked to billing documents. Do NOT compute "outstanding receivables" by subtracting payment totals from billing totals — this is meaningless because: (a) 56 of 120 payment records have negative amounts (accounting reversals), and (b) payments are not linked to specific invoices. If asked about outstanding receivables or unpaid invoices, state clearly that this dataset does not contain the linkage needed to compute it accurately.
7. Only SELECT statements. No INSERT, UPDATE, DELETE, DROP.
8. Default LIMIT 100 unless the question asks for more.`;

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

export async function fixSQL(originalSQL: string, question: string, error = ""): Promise<string> {
  const issue = error
    ? `This SQL threw an error: ${error}`
    : `This SQL returned 0 rows`;

  const { text } = await generateText({
    model: MODEL,
    system: SQL_SYSTEM,
    prompt: `${issue} for the question "${question}":
${originalSQL}

Fix it. Common causes:
- Missing table alias prefix on a column (ambiguous column error)
- Wrong join key (use ONLY the verified join paths above)
- NULL check on wrong column after LEFT JOIN (must check IS NULL on the join key)
- payments.invoiceReference is always NULL — remove any payment-to-billing join
Output ONLY the corrected raw SQL SELECT statement.`,
  });
  return cleanSQL(text);
}
