# Dodge AI — Order-to-Cash Graph Explorer

A graph-based data exploration and natural language query system built on an SAP Order-to-Cash dataset.

![Interface](docs/screenshot.png)

## Live Demo

[dodge-ai.vercel.app](https://dodge-ai.vercel.app) <!-- update after deploy -->

---

## What It Does

- Ingests a multi-entity SAP O2C dataset (sales orders, deliveries, billing docs, payments, journal entries, customers, products, plants) into a relational SQLite database
- Constructs a graph of entities and their relationships, visualized as an interactive force-directed graph
- Provides a chat interface where users ask questions in natural language — the system generates SQL, executes it, and streams a grounded answer
- Referenced entities in chat responses are highlighted on the graph in real time

---

## Architecture

```
Next.js 15 (App Router)
├── app/
│   ├── page.tsx               — Main layout: graph + chat panels
│   └── api/
│       ├── graph/route.ts     — Serves nodes + edges for the graph
│       ├── chat/route.ts      — NL query pipeline (guardrail → SQL → answer)
│       └── sessions/          — Chat session CRUD
├── components/
│   ├── GraphExplorer.tsx      — react-force-graph-2d canvas renderer
│   ├── ChatInterface.tsx      — Chat UI with session management
│   └── NodeDetails.tsx        — Node metadata overlay
├── lib/
│   ├── db.ts                  — better-sqlite3 singleton
│   ├── schema.ts              — CREATE TABLE statements + schema reference for LLM
│   └── llm-service.ts         — SQL generation, self-healing, guardrail
└── scripts/
    └── seed.ts                — JSONL ingestion + edge generation
```

---

## Database Choice: SQLite (better-sqlite3)

**Why SQLite:**
- The dataset is static — no concurrent writes, no multi-user mutations
- `better-sqlite3` runs synchronously in the Next.js server process, eliminating connection pooling overhead
- The entire O2C schema fits comfortably in a single file (`data.db`), deployable as a build artifact
- SQL is the right query language for this dataset: the data is highly relational, joins are well-defined, and the LLM is far better at generating SQL than graph traversal queries

**Trade-off:** A proper graph database (Neo4j, Amazon Neptune) would make multi-hop traversals more natural and performant at scale. For this dataset size and access pattern, SQLite's simplicity wins.

---

## Graph Modelling

Entities become **nodes**, foreign-key relationships become **edges**.

| Node Type | Source Table | Example |
|---|---|---|
| SalesOrder | `sales_order_headers` | SO 0000000050 |
| Delivery | `outbound_delivery_headers` | 0080000050 |
| BillingDoc | `billing_document_headers` | 0090000050 |
| Cancellation | `billing_document_cancellations` | Cancels billing doc |
| JournalEntry | `journal_entry_items` | GL posting |
| Payment | `payments` | AR clearing |
| Customer | `business_partners` | Sold-to party |
| Product | `products` | Material |
| Plant | `plants` | Shipping plant |

**Key edges:**

| Relationship | Meaning |
|---|---|
| `Delivery → FULFILLS_ORDER → SalesOrder` | Delivery references sales order via `referenceSdDocument` |
| `BillingDoc → BILLED_FROM_DELIVERY → Delivery` | Billing item references delivery |
| `JournalEntry → POSTED_FROM_BILLING → BillingDoc` | Journal references billing via `referenceDocument` |
| `Payment → PAYS_INVOICE → BillingDoc` | Payment clears invoice |
| `SalesOrder → PLACED_BY → Customer` | `soldToParty` → `businessPartner` |
| `Product → STOCKED_AT → Plant` | Product plant assignments |

Node size in the graph is proportional to degree (number of connections).

---

## LLM Prompting Strategy

The pipeline has two LLM calls per query:

### 1. SQL Generation
The model receives a detailed system prompt containing:
- Every table name, alias, and column list
- Verified join paths (with explicit warnings about joins that return 0 rows in this dataset)
- Query templates for common O2C patterns (trace flow, broken flows, product queries)
- Data quirks documented inline (e.g., `payments.invoiceReference` is always NULL)

This approach is **schema-first**: rather than asking the model to figure out the schema, we tell it exactly what exists and what works. The model outputs a raw `SELECT` statement — no markdown, no explanation.

### 2. Answer Generation
The model receives the SQL results (up to 50 rows) and strict rules:
- Report only what the data says — no estimates, no inferences
- Present exact values: IDs, amounts, dates
- End with `{"referencedIds": [...]}` so the UI can highlight graph nodes

### Self-Healing
If the first SQL throws an error or returns 0 rows, a second call asks the model to fix it, with the error message and a checklist of common failure modes (ambiguous columns, wrong join keys, NULL checks on wrong columns). The fixed query replaces the original if it returns more rows without error.

---

## Guardrails

Off-topic queries are blocked before the LLM is called, using a two-layer approach:

**Layer 1 — Regex patterns** (fast, zero-cost):
Blocks obvious off-topic signals: poems, lyrics, weather, sports, movies, recipes, jokes, general programming questions.

**Layer 2 — Domain constraint in answer prompt**:
The answer-generation prompt instructs the model to report only what the database returned. Even if a query slips past Layer 1 but generates empty SQL results, the model will state "no records found" rather than hallucinating an answer.

**Response:**
> "This system is designed to answer questions related to the Order-to-Cash dataset only."

The UI marks these responses with an "Out of scope" warning badge.

---

## Running Locally

```bash
# Install dependencies
npm install

# Seed the database (run once)
npm run seed

# Start dev server
npm run dev
```

Requires a `GEMINI_API_KEY` in `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

Free tier at [ai.google.dev](https://ai.google.dev) is sufficient.

---

## Example Queries

- *Which products are associated with the highest number of billing documents?*
- *Trace the full flow of billing document 90XXXXXXX*
- *Which sales orders were delivered but never billed?*
- *Show me cancelled billing documents from 2024*
- *Which customers have the most sales orders?*
- *Find sales orders with no delivery*

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | SQLite via `better-sqlite3` |
| Graph visualization | `react-force-graph-2d` |
| LLM | Google Gemini (via Vercel AI SDK) |
| Streaming | Vercel AI SDK `streamText` |
| UI | Tailwind CSS + shadcn/ui |
