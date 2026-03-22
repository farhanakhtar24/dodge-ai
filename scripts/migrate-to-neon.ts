/**
 * Seeds Neon Postgres directly from the /data JSONL folders.
 * Run with: npx tsx --env-file=.env.local scripts/migrate-to-neon.ts
 */

import { Client } from "pg";
import fs from "fs";
import readline from "readline";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

// ─── Column definitions (camelCase source of truth) ──────────────────────────

const TABLE_COLUMNS: Record<string, string[]> = {
  sales_order_headers: ["salesOrder","salesOrderType","salesOrganization","distributionChannel","organizationDivision","salesGroup","salesOffice","soldToParty","creationDate","createdByUser","lastChangeDateTime","totalNetAmount","overallDeliveryStatus","overallOrdReltdBillgStatus","overallSdDocReferenceStatus","transactionCurrency","pricingDate","requestedDeliveryDate","headerBillingBlockReason","deliveryBlockReason","incotermsClassification","incotermsLocation1","customerPaymentTerms","totalCreditCheckStatus"],
  sales_order_items: ["salesOrder","salesOrderItem","salesOrderItemCategory","material","requestedQuantity","requestedQuantityUnit","transactionCurrency","netAmount","materialGroup","productionPlant","storageLocation","salesDocumentRjcnReason","itemBillingBlockReason"],
  sales_order_schedule_lines: ["salesOrder","salesOrderItem","scheduleLine","confirmedDeliveryDate","orderQuantityUnit","confdOrderQtyByMatlAvailCheck"],
  outbound_delivery_headers: ["deliveryDocument","creationDate","creationTime_hours","creationTime_minutes","creationTime_seconds","actualGoodsMovementDate","actualGoodsMovementTime_hours","actualGoodsMovementTime_minutes","actualGoodsMovementTime_seconds","deliveryBlockReason","hdrGeneralIncompletionStatus","headerBillingBlockReason","lastChangeDate","overallGoodsMovementStatus","overallPickingStatus","overallProofOfDeliveryStatus","shippingPoint"],
  outbound_delivery_items: ["deliveryDocument","deliveryDocumentItem","actualDeliveryQuantity","batch","deliveryQuantityUnit","itemBillingBlockReason","lastChangeDate","plant","referenceSdDocument","referenceSdDocumentItem","storageLocation"],
  billing_document_headers: ["billingDocument","billingDocumentType","creationDate","creationTime_hours","creationTime_minutes","creationTime_seconds","lastChangeDateTime","billingDocumentDate","billingDocumentIsCancelled","cancelledBillingDocument","totalNetAmount","transactionCurrency","companyCode","fiscalYear","accountingDocument","soldToParty"],
  billing_document_items: ["billingDocument","billingDocumentItem","material","billingQuantity","billingQuantityUnit","netAmount","transactionCurrency","referenceSdDocument","referenceSdDocumentItem"],
  billing_document_cancellations: ["billingDocument","billingDocumentType","creationDate","billingDocumentIsCancelled","cancelledBillingDocument","totalNetAmount","transactionCurrency","companyCode","fiscalYear","accountingDocument","soldToParty"],
  journal_entry_items: ["companyCode","fiscalYear","accountingDocument","accountingDocumentItem","glAccount","referenceDocument","costCenter","profitCenter","transactionCurrency","amountInTransactionCurrency","companyCodeCurrency","amountInCompanyCodeCurrency","postingDate","documentDate","accountingDocumentType","assignmentReference","lastChangeDateTime","customer","financialAccountType","clearingDate","clearingAccountingDocument","clearingDocFiscalYear"],
  payments: ["companyCode","fiscalYear","accountingDocument","accountingDocumentItem","clearingDate","clearingAccountingDocument","clearingDocFiscalYear","amountInTransactionCurrency","transactionCurrency","amountInCompanyCodeCurrency","companyCodeCurrency","customer","invoiceReference","invoiceReferenceFiscalYear","salesDocument","salesDocumentItem","postingDate","documentDate","assignmentReference","glAccount","financialAccountType","profitCenter","costCenter"],
  business_partners: ["businessPartner","customer","businessPartnerCategory","businessPartnerGrouping","businessPartnerFullName","businessPartnerName","correspondenceLanguage","createdByUser","creationDate","creationTime_hours","creationTime_minutes","creationTime_seconds","firstName","formOfAddress","industry","lastName","organizationBpName1","organizationBpName2","businessPartnerIsBlocked","isMarkedForArchiving"],
  business_partner_addresses: ["businessPartner","addressId","validityStartDate","validityEndDate","addressUuid","addressTimeZone","cityName","country","postalCode","region","streetName","taxJurisdiction","transportZone"],
  customer_company_assignments: ["customer","companyCode","accountingClerk","paymentBlockingReason","paymentMethodsList","paymentTerms","reconciliationAccount","deletionIndicator","customerAccountGroup"],
  customer_sales_area_assignments: ["customer","salesOrganization","distributionChannel","division","billingIsBlockedForCustomer","completeDeliveryIsDefined","creditControlArea","currency","customerPaymentTerms","deliveryPriority","incotermsClassification","salesGroup","salesOffice","shippingCondition","supplyingPlant","salesDistrict"],
  products: ["product","productType","crossPlantStatus","creationDate","createdByUser","lastChangeDate","isMarkedForDeletion","productOldId","grossWeight","weightUnit","netWeight","productGroup","baseUnit","division","industrySector"],
  product_descriptions: ["product","language","productDescription"],
  plants: ["plant","plantName","valuationArea","salesOrganization","distributionChannel","division","language","isMarkedForArchiving"],
  product_plants: ["product","plant","countryOfOrigin","regionOfOrigin","profitCenter","mrpType"],
  product_storage_locations: ["product","plant","storageLocation"],
};

// Primary keys (lowercase)
const TABLE_PKS: Record<string, string[]> = {
  sales_order_headers: ["salesorder"],
  sales_order_items: ["salesorder", "salesorderitem"],
  sales_order_schedule_lines: ["salesorder", "salesorderitem", "scheduleline"],
  outbound_delivery_headers: ["deliverydocument"],
  outbound_delivery_items: ["deliverydocument", "deliverydocumentitem"],
  billing_document_headers: ["billingdocument"],
  billing_document_items: ["billingdocument", "billingdocumentitem"],
  billing_document_cancellations: ["billingdocument"],
  journal_entry_items: ["accountingdocument", "accountingdocumentitem", "fiscalyear", "companycode"],
  payments: ["accountingdocument", "accountingdocumentitem", "fiscalyear", "companycode"],
  business_partners: ["businesspartner"],
  business_partner_addresses: ["businesspartner", "addressid"],
  customer_company_assignments: ["customer", "companycode"],
  customer_sales_area_assignments: ["customer", "salesorganization", "distributionchannel", "division"],
  products: ["product"],
  product_descriptions: ["product", "language"],
  plants: ["plant"],
  product_plants: ["product", "plant"],
  product_storage_locations: ["product", "plant", "storagelocation"],
};

// INTEGER columns (empty string → NULL on insert)
const INTEGER_COLS = new Set([
  "billingdocumentiscancelled", "businesspartnerisblocked", "ismarkedforarchiving",
  "deletionindicator", "billingisblockedforcustomer", "completedeliveryisdefined",
  "ismarkedfordeletion",
]);

const FOLDER_TO_TABLE: Record<string, string> = {
  sales_order_headers: "sales_order_headers",
  sales_order_items: "sales_order_items",
  sales_order_schedule_lines: "sales_order_schedule_lines",
  outbound_delivery_headers: "outbound_delivery_headers",
  outbound_delivery_items: "outbound_delivery_items",
  billing_document_headers: "billing_document_headers",
  billing_document_items: "billing_document_items",
  billing_document_cancellations: "billing_document_cancellations",
  journal_entry_items_accounts_receivable: "journal_entry_items",
  payments_accounts_receivable: "payments",
  business_partners: "business_partners",
  business_partner_addresses: "business_partner_addresses",
  customer_company_assignments: "customer_company_assignments",
  customer_sales_area_assignments: "customer_sales_area_assignments",
  products: "products",
  product_descriptions: "product_descriptions",
  plants: "plants",
  product_plants: "product_plants",
  product_storage_locations: "product_storage_locations",
};

// ─── Schema generation (from TABLE_COLUMNS — no manual typing) ────────────────

function buildCreateTable(tableName: string): string {
  const cols = TABLE_COLUMNS[tableName];
  const pks = TABLE_PKS[tableName] ?? [];
  const pgCols = cols.map((c) => c.toLowerCase());

  const colDefs = pgCols.map((c) => {
    const type = INTEGER_COLS.has(c) ? "INTEGER" : "TEXT";
    if (pks.length === 1 && c === pks[0]) return `  "${c}" ${type} PRIMARY KEY`;
    return `  "${c}" ${type}`;
  });

  if (pks.length > 1) {
    colDefs.push(`  PRIMARY KEY (${pks.map((p) => `"${p}"`).join(", ")})`);
  }

  return `CREATE TABLE ${tableName} (\n${colDefs.join(",\n")}\n)`;
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(result, flatten(val as Record<string, unknown>, newKey));
    } else {
      result[newKey] = val === null ? null : typeof val === "boolean" ? (val ? 1 : 0) : val;
    }
  }
  return result;
}

async function readJsonlFolder(folderName: string): Promise<Record<string, unknown>[]> {
  const folderPath = path.join(DATA_DIR, folderName);
  if (!fs.existsSync(folderPath)) return [];
  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".jsonl"));
  const records: Record<string, unknown>[] = [];
  for (const file of files) {
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(folderPath, file)),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (line.trim()) {
        try { records.push(JSON.parse(line)); } catch { /* skip */ }
      }
    }
  }
  return records;
}

async function batchInsert(pg: Client, tableName: string, cols: string[], records: Record<string, unknown>[]) {
  if (records.length === 0) return 0;
  const flat = records.map((r) => flatten(r));
  const pgCols = cols.map((c) => c.toLowerCase());
  const BATCH = 200;
  let inserted = 0;

  for (let i = 0; i < flat.length; i += BATCH) {
    const batch = flat.slice(i, i + BATCH);
    const placeholders = batch.map((_, bi) =>
      `(${pgCols.map((_, ci) => `$${bi * pgCols.length + ci + 1}`).join(", ")})`
    ).join(", ");
    const values = batch.flatMap((row) =>
      cols.map((c) => {
        const v = row[c] !== undefined ? row[c] : null;
        if (INTEGER_COLS.has(c.toLowerCase()) && (v === "" || v === undefined)) return null;
        return v ?? null;
      })
    );
    await pg.query(
      `INSERT INTO ${tableName} (${pgCols.map((c) => `"${c}"`).join(", ")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    );
    inserted += batch.length;
  }
  return inserted;
}

// ─── Edge generation ─────────────────────────────────────────────────────────

async function generateEdges(pg: Client) {
  let count = 0;
  const ins = async (sId: string, sType: string, tId: string, tType: string, label: string) => {
    await pg.query(
      `INSERT INTO edges (source_id, source_type, target_id, target_type, relationship_label) VALUES ($1,$2,$3,$4,$5)`,
      [sId, sType, tId, tType, label]
    );
    count++;
  };

  const q = async (sql: string) => (await pg.query(sql)).rows;

  const runEdges = async (label: string, rows: Record<string, unknown>[], fn: (r: Record<string, unknown>) => Promise<void>) => {
    process.stdout.write(`  ${label}: ${rows.length} records → `);
    for (const r of rows) await fn(r);
    console.log(`done`);
  };

  await runEdges("SO → Customer (PLACED_BY)",
    await q(`SELECT salesorder, soldtoparty FROM sales_order_headers WHERE soldtoparty != ''`),
    async (r) => ins(r.salesorder as string, "SalesOrder", r.soldtoparty as string, "Customer", "PLACED_BY")
  );

  await runEdges("SOItem → SO + Product",
    await q(`SELECT salesorder, salesorderitem, material FROM sales_order_items`),
    async (r) => {
      await ins(r.salesorderitem as string, "SOItem", r.salesorder as string, "SalesOrder", "ITEM_OF");
      if (r.material) await ins(r.salesorderitem as string, "SOItem", r.material as string, "Product", "CONTAINS_PRODUCT");
    }
  );

  await runEdges("Delivery → SO (FULFILLS_ORDER)",
    await q(`SELECT DISTINCT deliverydocument, referencesddocument FROM outbound_delivery_items WHERE referencesddocument != ''`),
    async (r) => ins(r.deliverydocument as string, "Delivery", r.referencesddocument as string, "SalesOrder", "FULFILLS_ORDER")
  );

  await runEdges("BillingDoc → Delivery (BILLED_FROM_DELIVERY)",
    await q(`SELECT DISTINCT billingdocument, referencesddocument FROM billing_document_items WHERE referencesddocument != ''`),
    async (r) => ins(r.billingdocument as string, "BillingDoc", r.referencesddocument as string, "Delivery", "BILLED_FROM_DELIVERY")
  );

  await runEdges("JournalEntry → BillingDoc (POSTED_FROM_BILLING)",
    await q(`SELECT DISTINCT accountingdocument, referencedocument FROM journal_entry_items WHERE referencedocument != ''`),
    async (r) => ins(r.accountingdocument as string, "JournalEntry", r.referencedocument as string, "BillingDoc", "POSTED_FROM_BILLING")
  );

  await runEdges("Payment → BillingDoc (PAYS_INVOICE)",
    await q(`SELECT DISTINCT accountingdocument, invoicereference FROM payments WHERE invoicereference IS NOT NULL AND invoicereference != ''`),
    async (r) => ins(r.accountingdocument as string, "Payment", r.invoicereference as string, "BillingDoc", "PAYS_INVOICE")
  );

  await runEdges("Payment → SO (PAYMENT_FOR_ORDER)",
    await q(`SELECT DISTINCT accountingdocument, salesdocument FROM payments WHERE salesdocument IS NOT NULL AND salesdocument != ''`),
    async (r) => ins(r.accountingdocument as string, "Payment", r.salesdocument as string, "SalesOrder", "PAYMENT_FOR_ORDER")
  );

  await runEdges("Cancellation → BillingDoc (CANCELS)",
    await q(`SELECT billingdocument, cancelledbillingdocument FROM billing_document_cancellations WHERE cancelledbillingdocument != ''`),
    async (r) => ins(r.billingdocument as string, "Cancellation", r.cancelledbillingdocument as string, "BillingDoc", "CANCELS")
  );

  await runEdges("Address → Customer (ADDRESS_OF)",
    await q(`SELECT businesspartner, addressid FROM business_partner_addresses`),
    async (r) => ins(r.addressid as string, "Address", r.businesspartner as string, "Customer", "ADDRESS_OF")
  );

  await runEdges("Product → Plant (STOCKED_AT)",
    await q(`SELECT product, plant FROM product_plants`),
    async (r) => ins(r.product as string, "Product", r.plant as string, "Plant", "STOCKED_AT")
  );

  return count;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  console.log("Connected to Neon.\n");

  // Drop all tables and recreate
  console.log("Dropping existing tables...");
  const dropOrder = [
    "chat_messages", "chat_sessions", "edges",
    "product_storage_locations", "product_plants", "product_descriptions", "plants", "products",
    "customer_sales_area_assignments", "customer_company_assignments",
    "business_partner_addresses", "business_partners",
    "payments", "journal_entry_items",
    "billing_document_cancellations", "billing_document_items", "billing_document_headers",
    "outbound_delivery_items", "outbound_delivery_headers",
    "sales_order_schedule_lines", "sales_order_items", "sales_order_headers",
  ];
  for (const t of dropOrder) await pg.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);

  // Create data tables from TABLE_COLUMNS (no manual column typing)
  console.log("Creating tables...");
  for (const tableName of Object.keys(TABLE_COLUMNS)) {
    await pg.query(buildCreateTable(tableName));
  }
  await pg.query(`CREATE TABLE edges (id SERIAL PRIMARY KEY, source_id TEXT NOT NULL, source_type TEXT NOT NULL, target_id TEXT NOT NULL, target_type TEXT NOT NULL, relationship_label TEXT NOT NULL)`);
  await pg.query(`CREATE INDEX idx_edges_source ON edges(source_id)`);
  await pg.query(`CREATE INDEX idx_edges_target ON edges(target_id)`);
  await pg.query(`CREATE TABLE chat_sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'New Chat', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await pg.query(`CREATE TABLE chat_messages (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('user', 'assistant')), content TEXT NOT NULL DEFAULT '', sql TEXT, row_count INTEGER, is_guardrail INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await pg.query(`CREATE INDEX idx_messages_session ON chat_messages(session_id)`);
  console.log("Schema ready.\n");

  // Insert data
  let totalRows = 0;
  for (const [folder, table] of Object.entries(FOLDER_TO_TABLE)) {
    const records = await readJsonlFolder(folder);
    if (records.length === 0) { console.log(`  ${table}: no records`); continue; }
    const count = await batchInsert(pg, table, TABLE_COLUMNS[table], records);
    console.log(`  ${table}: ${count} rows`);
    totalRows += count;
  }

  // Generate edges
  console.log("\nGenerating edges...");
  const edgeCount = await generateEdges(pg);
  console.log(`  edges: ${edgeCount}`);

  await pg.end();
  console.log(`\nDone. ${totalRows} rows + ${edgeCount} edges loaded into Neon.`);
}

main().catch((e) => {
  console.error("\nFailed:", e.message);
  process.exit(1);
});
