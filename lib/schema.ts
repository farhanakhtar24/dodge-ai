export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS sales_order_headers (
  salesOrder TEXT PRIMARY KEY,
  salesOrderType TEXT,
  salesOrganization TEXT,
  distributionChannel TEXT,
  organizationDivision TEXT,
  salesGroup TEXT,
  salesOffice TEXT,
  soldToParty TEXT,
  creationDate TEXT,
  createdByUser TEXT,
  lastChangeDateTime TEXT,
  totalNetAmount TEXT,
  overallDeliveryStatus TEXT,
  overallOrdReltdBillgStatus TEXT,
  overallSdDocReferenceStatus TEXT,
  transactionCurrency TEXT,
  pricingDate TEXT,
  requestedDeliveryDate TEXT,
  headerBillingBlockReason TEXT,
  deliveryBlockReason TEXT,
  incotermsClassification TEXT,
  incotermsLocation1 TEXT,
  customerPaymentTerms TEXT,
  totalCreditCheckStatus TEXT
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  salesOrder TEXT,
  salesOrderItem TEXT,
  salesOrderItemCategory TEXT,
  material TEXT,
  requestedQuantity TEXT,
  requestedQuantityUnit TEXT,
  transactionCurrency TEXT,
  netAmount TEXT,
  materialGroup TEXT,
  productionPlant TEXT,
  storageLocation TEXT,
  salesDocumentRjcnReason TEXT,
  itemBillingBlockReason TEXT,
  PRIMARY KEY (salesOrder, salesOrderItem)
);

CREATE TABLE IF NOT EXISTS sales_order_schedule_lines (
  salesOrder TEXT,
  salesOrderItem TEXT,
  scheduleLine TEXT,
  confirmedDeliveryDate TEXT,
  orderQuantityUnit TEXT,
  confdOrderQtyByMatlAvailCheck TEXT,
  PRIMARY KEY (salesOrder, salesOrderItem, scheduleLine)
);

CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
  deliveryDocument TEXT PRIMARY KEY,
  creationDate TEXT,
  creationTime_hours TEXT,
  creationTime_minutes TEXT,
  creationTime_seconds TEXT,
  actualGoodsMovementDate TEXT,
  actualGoodsMovementTime_hours TEXT,
  actualGoodsMovementTime_minutes TEXT,
  actualGoodsMovementTime_seconds TEXT,
  deliveryBlockReason TEXT,
  hdrGeneralIncompletionStatus TEXT,
  headerBillingBlockReason TEXT,
  lastChangeDate TEXT,
  overallGoodsMovementStatus TEXT,
  overallPickingStatus TEXT,
  overallProofOfDeliveryStatus TEXT,
  shippingPoint TEXT
);

CREATE TABLE IF NOT EXISTS outbound_delivery_items (
  deliveryDocument TEXT,
  deliveryDocumentItem TEXT,
  actualDeliveryQuantity TEXT,
  batch TEXT,
  deliveryQuantityUnit TEXT,
  itemBillingBlockReason TEXT,
  lastChangeDate TEXT,
  plant TEXT,
  referenceSdDocument TEXT,
  referenceSdDocumentItem TEXT,
  storageLocation TEXT,
  PRIMARY KEY (deliveryDocument, deliveryDocumentItem)
);

CREATE TABLE IF NOT EXISTS billing_document_headers (
  billingDocument TEXT PRIMARY KEY,
  billingDocumentType TEXT,
  creationDate TEXT,
  creationTime_hours TEXT,
  creationTime_minutes TEXT,
  creationTime_seconds TEXT,
  lastChangeDateTime TEXT,
  billingDocumentDate TEXT,
  billingDocumentIsCancelled INTEGER,
  cancelledBillingDocument TEXT,
  totalNetAmount TEXT,
  transactionCurrency TEXT,
  companyCode TEXT,
  fiscalYear TEXT,
  accountingDocument TEXT,
  soldToParty TEXT
);

CREATE TABLE IF NOT EXISTS billing_document_items (
  billingDocument TEXT,
  billingDocumentItem TEXT,
  material TEXT,
  billingQuantity TEXT,
  billingQuantityUnit TEXT,
  netAmount TEXT,
  transactionCurrency TEXT,
  referenceSdDocument TEXT,
  referenceSdDocumentItem TEXT,
  PRIMARY KEY (billingDocument, billingDocumentItem)
);

CREATE TABLE IF NOT EXISTS billing_document_cancellations (
  billingDocument TEXT PRIMARY KEY,
  billingDocumentType TEXT,
  creationDate TEXT,
  billingDocumentIsCancelled INTEGER,
  cancelledBillingDocument TEXT,
  totalNetAmount TEXT,
  transactionCurrency TEXT,
  companyCode TEXT,
  fiscalYear TEXT,
  accountingDocument TEXT,
  soldToParty TEXT
);

CREATE TABLE IF NOT EXISTS journal_entry_items (
  companyCode TEXT,
  fiscalYear TEXT,
  accountingDocument TEXT,
  accountingDocumentItem TEXT,
  glAccount TEXT,
  referenceDocument TEXT,
  costCenter TEXT,
  profitCenter TEXT,
  transactionCurrency TEXT,
  amountInTransactionCurrency TEXT,
  companyCodeCurrency TEXT,
  amountInCompanyCodeCurrency TEXT,
  postingDate TEXT,
  documentDate TEXT,
  accountingDocumentType TEXT,
  assignmentReference TEXT,
  lastChangeDateTime TEXT,
  customer TEXT,
  financialAccountType TEXT,
  clearingDate TEXT,
  clearingAccountingDocument TEXT,
  clearingDocFiscalYear TEXT,
  PRIMARY KEY (accountingDocument, accountingDocumentItem, fiscalYear, companyCode)
);

CREATE TABLE IF NOT EXISTS payments (
  companyCode TEXT,
  fiscalYear TEXT,
  accountingDocument TEXT,
  accountingDocumentItem TEXT,
  clearingDate TEXT,
  clearingAccountingDocument TEXT,
  clearingDocFiscalYear TEXT,
  amountInTransactionCurrency TEXT,
  transactionCurrency TEXT,
  amountInCompanyCodeCurrency TEXT,
  companyCodeCurrency TEXT,
  customer TEXT,
  invoiceReference TEXT,
  invoiceReferenceFiscalYear TEXT,
  salesDocument TEXT,
  salesDocumentItem TEXT,
  postingDate TEXT,
  documentDate TEXT,
  assignmentReference TEXT,
  glAccount TEXT,
  financialAccountType TEXT,
  profitCenter TEXT,
  costCenter TEXT,
  PRIMARY KEY (accountingDocument, accountingDocumentItem, fiscalYear, companyCode)
);

CREATE TABLE IF NOT EXISTS business_partners (
  businessPartner TEXT PRIMARY KEY,
  customer TEXT,
  businessPartnerCategory TEXT,
  businessPartnerGrouping TEXT,
  businessPartnerFullName TEXT,
  businessPartnerName TEXT,
  correspondenceLanguage TEXT,
  createdByUser TEXT,
  creationDate TEXT,
  creationTime_hours TEXT,
  creationTime_minutes TEXT,
  creationTime_seconds TEXT,
  firstName TEXT,
  formOfAddress TEXT,
  industry TEXT,
  lastName TEXT,
  organizationBpName1 TEXT,
  organizationBpName2 TEXT,
  businessPartnerIsBlocked INTEGER,
  isMarkedForArchiving INTEGER
);

CREATE TABLE IF NOT EXISTS business_partner_addresses (
  businessPartner TEXT,
  addressId TEXT,
  validityStartDate TEXT,
  validityEndDate TEXT,
  addressUuid TEXT,
  addressTimeZone TEXT,
  cityName TEXT,
  country TEXT,
  postalCode TEXT,
  region TEXT,
  streetName TEXT,
  taxJurisdiction TEXT,
  transportZone TEXT,
  PRIMARY KEY (businessPartner, addressId)
);

CREATE TABLE IF NOT EXISTS customer_company_assignments (
  customer TEXT,
  companyCode TEXT,
  accountingClerk TEXT,
  paymentBlockingReason TEXT,
  paymentMethodsList TEXT,
  paymentTerms TEXT,
  reconciliationAccount TEXT,
  deletionIndicator INTEGER,
  customerAccountGroup TEXT,
  PRIMARY KEY (customer, companyCode)
);

CREATE TABLE IF NOT EXISTS customer_sales_area_assignments (
  customer TEXT,
  salesOrganization TEXT,
  distributionChannel TEXT,
  division TEXT,
  billingIsBlockedForCustomer INTEGER,
  completeDeliveryIsDefined INTEGER,
  creditControlArea TEXT,
  currency TEXT,
  customerPaymentTerms TEXT,
  deliveryPriority TEXT,
  incotermsClassification TEXT,
  salesGroup TEXT,
  salesOffice TEXT,
  shippingCondition TEXT,
  supplyingPlant TEXT,
  salesDistrict TEXT,
  PRIMARY KEY (customer, salesOrganization, distributionChannel, division)
);

CREATE TABLE IF NOT EXISTS products (
  product TEXT PRIMARY KEY,
  productType TEXT,
  crossPlantStatus TEXT,
  creationDate TEXT,
  createdByUser TEXT,
  lastChangeDate TEXT,
  isMarkedForDeletion INTEGER,
  productOldId TEXT,
  grossWeight TEXT,
  weightUnit TEXT,
  netWeight TEXT,
  productGroup TEXT,
  baseUnit TEXT,
  division TEXT,
  industrySector TEXT
);

CREATE TABLE IF NOT EXISTS product_descriptions (
  product TEXT,
  language TEXT,
  productDescription TEXT,
  PRIMARY KEY (product, language)
);

CREATE TABLE IF NOT EXISTS plants (
  plant TEXT PRIMARY KEY,
  plantName TEXT,
  valuationArea TEXT,
  salesOrganization TEXT,
  distributionChannel TEXT,
  division TEXT,
  language TEXT,
  isMarkedForArchiving INTEGER
);

CREATE TABLE IF NOT EXISTS product_plants (
  product TEXT,
  plant TEXT,
  countryOfOrigin TEXT,
  regionOfOrigin TEXT,
  profitCenter TEXT,
  mrpType TEXT,
  PRIMARY KEY (product, plant)
);

CREATE TABLE IF NOT EXISTS product_storage_locations (
  product TEXT,
  plant TEXT,
  storageLocation TEXT,
  PRIMARY KEY (product, plant, storageLocation)
);

CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  relationship_label TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
`;

export const SCHEMA_FOR_LLM = `
-- ORDER TO CASH SQLITE SCHEMA --

TABLE: sales_order_headers
  salesOrder (PK), salesOrderType, salesOrganization, soldToParty,
  totalNetAmount, overallDeliveryStatus, overallOrdReltdBillgStatus,
  transactionCurrency, creationDate, requestedDeliveryDate

TABLE: sales_order_items
  salesOrder, salesOrderItem (PK together), material, requestedQuantity,
  requestedQuantityUnit, netAmount, productionPlant, storageLocation

TABLE: sales_order_schedule_lines
  salesOrder, salesOrderItem, scheduleLine (PK together), confirmedDeliveryDate,
  confdOrderQtyByMatlAvailCheck, orderQuantityUnit

TABLE: outbound_delivery_headers
  deliveryDocument (PK), creationDate, actualGoodsMovementDate,
  overallGoodsMovementStatus, overallPickingStatus, shippingPoint

TABLE: outbound_delivery_items
  deliveryDocument, deliveryDocumentItem (PK together), actualDeliveryQuantity,
  plant, referenceSdDocument (→ salesOrder), referenceSdDocumentItem, storageLocation

TABLE: billing_document_headers
  billingDocument (PK), billingDocumentType, billingDocumentDate,
  totalNetAmount, transactionCurrency, companyCode, fiscalYear,
  accountingDocument, soldToParty, billingDocumentIsCancelled, cancelledBillingDocument

TABLE: billing_document_items
  billingDocument, billingDocumentItem (PK together), material, billingQuantity,
  netAmount, referenceSdDocument (→ deliveryDocument), referenceSdDocumentItem

TABLE: billing_document_cancellations
  billingDocument (PK), cancelledBillingDocument, totalNetAmount, companyCode

TABLE: journal_entry_items
  accountingDocument, accountingDocumentItem, fiscalYear, companyCode (PK together),
  glAccount, referenceDocument (→ billingDocument), amountInTransactionCurrency,
  transactionCurrency, postingDate, customer, clearingDate, clearingAccountingDocument

TABLE: payments
  accountingDocument, accountingDocumentItem, fiscalYear, companyCode (PK together),
  clearingDate, amountInTransactionCurrency, transactionCurrency, customer,
  invoiceReference (→ billingDocument), salesDocument (→ salesOrder), postingDate

TABLE: business_partners
  businessPartner (PK), customer, businessPartnerFullName, businessPartnerCategory,
  creationDate, businessPartnerIsBlocked

TABLE: business_partner_addresses
  businessPartner, addressId (PK together), cityName, country, postalCode, streetName, region

TABLE: products
  product (PK), productType, grossWeight, netWeight, weightUnit, productGroup, baseUnit

TABLE: product_descriptions
  product, language (PK together), productDescription

TABLE: plants
  plant (PK), plantName, salesOrganization, distributionChannel

TABLE: product_plants
  product, plant (PK together), countryOfOrigin, profitCenter, mrpType

-- VERIFIED WORKING JOIN CONDITIONS --
sales_order_headers.soldToParty = business_partners.businessPartner
sales_order_items.salesOrder = sales_order_headers.salesOrder
billing_document_items.material = products.product  (direct — use this for product queries, NOT through sales_order_items)
outbound_delivery_items.referenceSdDocument = sales_order_headers.salesOrder  (JOIN ON THIS SINGLE KEY ONLY)
outbound_delivery_items.deliveryDocument = outbound_delivery_headers.deliveryDocument
billing_document_items.referenceSdDocument = outbound_delivery_headers.deliveryDocument
billing_document_items.billingDocument = billing_document_headers.billingDocument
journal_entry_items.referenceDocument = billing_document_headers.billingDocument
payments.invoiceReference = billing_document_headers.billingDocument
payments.salesDocument = sales_order_headers.salesOrder

IMPORTANT: NEVER join on both referenceSdDocument AND referenceSdDocumentItem — always use referenceSdDocument alone.

-- O2C FLOW --
Sales Order → Delivery: outbound_delivery_items ON referenceSdDocument = salesOrder
Delivery → Billing: billing_document_items ON referenceSdDocument = deliveryDocument
Billing → Journal: journal_entry_items ON referenceDocument = billingDocument
Billing → Payment: payments ON invoiceReference = billingDocument

-- BROKEN FLOW DETECTION --
Unbilled deliveries: outbound_delivery_headers LEFT JOIN billing_document_items ON deliveryDocument = referenceSdDocument WHERE billingDocument IS NULL
Undelivered orders: sales_order_headers WHERE overallDeliveryStatus != 'C'
Unpaid invoices: billing_document_headers LEFT JOIN payments ON billingDocument = invoiceReference WHERE payments side IS NULL
`;
