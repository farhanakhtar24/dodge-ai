import Database from "better-sqlite3";
import fs from "fs";
import readline from "readline";
import path from "path";
import { CREATE_TABLES } from "../lib/schema";

const DB_PATH = path.join(process.cwd(), "data.db");
const DATA_DIR = path.join(process.cwd(), "data");

// Remove existing DB to start fresh
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log("[SEED] Removed existing database.");
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF"); // off during bulk insert

// Create all tables
db.exec(CREATE_TABLES);
console.log("[SEED] Tables created.");

// ─── Flatten nested objects ───────────────────────────────────────────────────
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

// ─── Read all JSONL files in a folder ─────────────────────────────────────────
async function readJsonlFolder(folderName: string): Promise<Record<string, unknown>[]> {
  const folderPath = path.join(DATA_DIR, folderName);
  if (!fs.existsSync(folderPath)) return [];
  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".jsonl"));
  const records: Record<string, unknown>[] = [];
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) {
        try {
          records.push(JSON.parse(line));
        } catch { /* skip malformed lines */ }
      }
    }
  }
  return records;
}

// ─── Upsert helper ────────────────────────────────────────────────────────────
function upsertAll(tableName: string, records: Record<string, unknown>[], columns: string[]) {
  if (records.length === 0) return 0;
  const flatRecords = records.map((r) => flatten(r));
  // filter columns to those that exist in schema
  const validCols = columns.filter((c) => c in flatRecords[0] || flatRecords.some((r) => c in r));
  if (validCols.length === 0) return 0;
  const placeholders = validCols.map(() => "?").join(", ");
  const colList = validCols.map((c) => `"${c}"`).join(", ");
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${tableName} (${colList}) VALUES (${placeholders})`
  );
  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    let count = 0;
    for (const row of rows) {
      const values = validCols.map((c) => (row[c] !== undefined ? row[c] : null));
      stmt.run(values);
      count++;
    }
    return count;
  });
  return insertMany(flatRecords);
}

// ─── Column definitions per table ─────────────────────────────────────────────
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

// ─── Main ingestion ────────────────────────────────────────────────────────────
async function main() {
  let totalNodes = 0;

  for (const [folder, table] of Object.entries(FOLDER_TO_TABLE)) {
    const records = await readJsonlFolder(folder);
    if (records.length === 0) {
      console.log(`[SEED] ${folder}: no records found`);
      continue;
    }
    const cols = TABLE_COLUMNS[table];
    const count = upsertAll(table, records, cols);
    console.log(`[SEED] ${table}: ${count} records`);
    totalNodes += count;
  }

  // ─── Edge generation ───────────────────────────────────────────────────────
  console.log("[SEED] Generating edges...");

  const insertEdge = db.prepare(
    `INSERT INTO edges (source_id, source_type, target_id, target_type, relationship_label)
     VALUES (?, ?, ?, ?, ?)`
  );

  const addEdges = db.transaction(() => {
    let edgeCount = 0;

    // SO → Customer (PLACED_BY)
    const soHeaders = db.prepare("SELECT salesOrder, soldToParty FROM sales_order_headers WHERE soldToParty != ''").all() as {salesOrder: string; soldToParty: string}[];
    for (const r of soHeaders) {
      insertEdge.run(r.salesOrder, "SalesOrder", r.soldToParty, "Customer", "PLACED_BY");
      edgeCount++;
    }

    // SOItem → SO (HAS_ITEM)
    const soItems = db.prepare("SELECT salesOrder, salesOrderItem, material FROM sales_order_items").all() as {salesOrder: string; salesOrderItem: string; material: string}[];
    for (const r of soItems) {
      insertEdge.run(r.salesOrderItem, "SOItem", r.salesOrder, "SalesOrder", "ITEM_OF");
      edgeCount++;
      if (r.material) {
        insertEdge.run(r.salesOrderItem, "SOItem", r.material, "Product", "CONTAINS_PRODUCT");
        edgeCount++;
      }
    }

    // Delivery item → SO (FULFILLS_ORDER)
    const delItems = db.prepare("SELECT deliveryDocument, deliveryDocumentItem, referenceSdDocument FROM outbound_delivery_items WHERE referenceSdDocument != ''").all() as {deliveryDocument: string; deliveryDocumentItem: string; referenceSdDocument: string}[];
    for (const r of delItems) {
      insertEdge.run(r.deliveryDocument, "Delivery", r.referenceSdDocument, "SalesOrder", "FULFILLS_ORDER");
      edgeCount++;
    }

    // Billing item → Delivery (BILLED_FROM_DELIVERY)
    const bilItems = db.prepare("SELECT billingDocument, referenceSdDocument FROM billing_document_items WHERE referenceSdDocument != ''").all() as {billingDocument: string; referenceSdDocument: string}[];
    const seenBilDel = new Set<string>();
    for (const r of bilItems) {
      const key = `${r.billingDocument}|${r.referenceSdDocument}`;
      if (!seenBilDel.has(key)) {
        insertEdge.run(r.billingDocument, "BillingDoc", r.referenceSdDocument, "Delivery", "BILLED_FROM_DELIVERY");
        seenBilDel.add(key);
        edgeCount++;
      }
    }

    // Journal → Billing (POSTED_TO_JOURNAL)
    const journals = db.prepare("SELECT accountingDocument, referenceDocument FROM journal_entry_items WHERE referenceDocument != ''").all() as {accountingDocument: string; referenceDocument: string}[];
    const seenJournalBil = new Set<string>();
    for (const r of journals) {
      const key = `${r.accountingDocument}|${r.referenceDocument}`;
      if (!seenJournalBil.has(key)) {
        insertEdge.run(r.accountingDocument, "JournalEntry", r.referenceDocument, "BillingDoc", "POSTED_FROM_BILLING");
        seenJournalBil.add(key);
        edgeCount++;
      }
    }

    // Payment → Billing (PAYS_INVOICE)
    const pays = db.prepare("SELECT accountingDocument, invoiceReference FROM payments WHERE invoiceReference IS NOT NULL AND invoiceReference != ''").all() as {accountingDocument: string; invoiceReference: string}[];
    const seenPayBil = new Set<string>();
    for (const r of pays) {
      const key = `${r.accountingDocument}|${r.invoiceReference}`;
      if (!seenPayBil.has(key)) {
        insertEdge.run(r.accountingDocument, "Payment", r.invoiceReference, "BillingDoc", "PAYS_INVOICE");
        seenPayBil.add(key);
        edgeCount++;
      }
    }

    // Payment → SO
    const paysSO = db.prepare("SELECT accountingDocument, salesDocument FROM payments WHERE salesDocument IS NOT NULL AND salesDocument != ''").all() as {accountingDocument: string; salesDocument: string}[];
    const seenPaySO = new Set<string>();
    for (const r of paysSO) {
      const key = `${r.accountingDocument}|${r.salesDocument}`;
      if (!seenPaySO.has(key)) {
        insertEdge.run(r.accountingDocument, "Payment", r.salesDocument, "SalesOrder", "PAYMENT_FOR_ORDER");
        seenPaySO.add(key);
        edgeCount++;
      }
    }

    // Cancellation → BillingDoc (CANCELS)
    const cancels = db.prepare("SELECT billingDocument, cancelledBillingDocument FROM billing_document_cancellations WHERE cancelledBillingDocument != ''").all() as {billingDocument: string; cancelledBillingDocument: string}[];
    for (const r of cancels) {
      insertEdge.run(r.billingDocument, "Cancellation", r.cancelledBillingDocument, "BillingDoc", "CANCELS");
      edgeCount++;
    }

    // Address → BP
    const addresses = db.prepare("SELECT businessPartner, addressId FROM business_partner_addresses").all() as {businessPartner: string; addressId: string}[];
    for (const r of addresses) {
      insertEdge.run(r.addressId, "Address", r.businessPartner, "Customer", "ADDRESS_OF");
      edgeCount++;
    }

    // ProductPlant → Product
    const productPlants = db.prepare("SELECT product, plant FROM product_plants").all() as {product: string; plant: string}[];
    for (const r of productPlants) {
      insertEdge.run(r.product, "Product", r.plant, "Plant", "STOCKED_AT");
      edgeCount++;
    }

    return edgeCount;
  });

  const totalEdges = addEdges();

  console.log(`\n[SEED] ✓ Complete`);
  console.log(`[SEED] Total nodes: ${totalNodes}`);
  console.log(`[SEED] Total edges: ${totalEdges}`);

  db.close();
}

main().catch((e) => {
  console.error("[SEED] Error:", e);
  process.exit(1);
});
