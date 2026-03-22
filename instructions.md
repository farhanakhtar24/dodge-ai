This is a **Master Orchestration File**. Save this as `INSTRUCTIONS_FOR_AI.md` in our project root.

When you start your session with Cursor or Claude, upload this file and tell the AI:

> **"Read this entire file. We are going to follow this roadmap strictly. Do NOT skip ahead. Complete one section at a time, show me the code, and WAIT for my 'PROCEED' command before moving to the next section."**

---

# 📑 MASTER ORCHESTRATION: ORDER-TO-CASH GRAPH AI

## 🤖 AI SYSTEM INSTRUCTIONS

1. **Sequential Execution:** You must complete the tasks in the order listed.
2. **User Gatekeeping:** After finishing a section, you must stop and wait for the user to say "PROCEED".
3. **Architecture First:** Every line of code must align with the "Forward Deployed Engineer" mindset: Speed, Reliability, and Data Accuracy.
4. **Error Logging:** If a library or implementation fails, document the error in the chat before suggesting a fix.
5. **No Hallucinations:** Use only the provided schema logic. Do not invent columns.

---

## 🏗️ SECTION 0: PROJECT INITIALIZATION

**Goal:** Bootstrap the Next.js environment and install core dependencies.

- Initialize a **Next.js (App Router)** project with Tailwind CSS and TypeScript.
- Install the following specific stack:
    - `better-sqlite3` (Database)
    - `csv-parser` (Data ingestion)
    - `groq-sdk` (LLM Inference)
    - `react-force-graph-2d` (Visualization)
    - `lucide-react` (Icons)
    - `clsx` & `tailwind-merge` (Styling utils)
- Setup a folder structure: `/data` (for CSVs), `/scripts` (for seeding), `/lib` (for DB logic).

**[STOP - WAIT FOR USER TO CONFIRM SETUP]**

---

## 📊 SECTION 1: DATA MODELING & INGESTION

**Goal:** Convert fragmented CSVs into a relational-graph hybrid database.

- **Logic:** We are using **SQLite** but modeling it as a **Graph**.
- **Tables to create:**
    1.  `orders`, `deliveries`, `invoices`, `payments`, `customers`, `products`.
    2.  `edges` table: `id`, `source_id`, `target_id`, `source_type`, `target_type`, `relationship_label`.
- **Script (`scripts/seed.ts`):**
    - Parse the CSVs in the `/data` folder.
    - Populate entity tables.
    - **Heuristic Mapping:** Automatically generate entries for the `edges` table based on foreign keys (e.g., if a Delivery record has an `OrderID`, create an edge: `Order -> Delivery`).
- **Validation:** Log the total count of Nodes and Edges created to the console.

**[STOP - WAIT FOR USER TO RUN SEED SCRIPT AND VERIFY DB]**

---

## 🌐 SECTION 2: GRAPH DATA API

**Goal:** Create a performant endpoint to feed the visualization.

- Create `app/api/graph/route.ts`.
- **Query:** Fetch all entities from entity tables and all relationships from the `edges` table.
- **Format:** Transform data into a standard Graph JSON format:
    ```json
    {
      "nodes": [{ "id": "ORD123", "label": "Order", "val": 10, "details": {...} }],
      "links": [{ "source": "ORD123", "target": "DEL456", "label": "SHIPPED_VIA" }]
    }
    ```
- **Edge Case:** If the dataset is huge (>500 nodes), implement a `LIMIT` to prevent the UI from crashing, but keep all edges related to those nodes.

**[STOP - WAIT FOR USER TO TEST API VIA BROWSER]**

---

## 🎨 SECTION 3: INTERACTIVE GRAPH VISUALIZATION

**Goal:** Build the visual explorer.

- Create `components/GraphExplorer.tsx`.
- **Requirements:**
    - Use `react-force-graph-2d` (Import with `next/dynamic` to disable SSR).
    - **Node Coloring:** Assign distinct colors to node types (Orders=Blue, Invoices=Green, etc.).
    - **Interactivity:** Clicking a node should display its metadata (the "details" object) in a sidebar or tooltip.
    - **Responsive:** Ensure it fills 70% of the screen width and 100% height.
- Integrate this into `app/page.tsx`.

**[STOP - WAIT FOR USER TO INTERACT WITH GRAPH]**

---

## 🧠 SECTION 4: THE LLM BRAIN (TEXT-TO-SQL)

**Goal:** Create the intelligence layer using Groq/Gemini.

- Create `lib/llm-service.ts` to handle API calls.
- Create `app/api/chat/route.ts`.
- **The Pipeline:**
    1.  **System Prompt:** Inject the **Full SQLite Schema** (Table names and Columns).
    2.  **Logic:** Instruct the LLM to output **ONLY** a raw SQL string.
    3.  **Security:** Ensure the LLM only generates `SELECT` queries.
    4.  **Flow:** User Question -> LLM Generates SQL -> Backend executes SQL in SQLite -> SQL Results + Question sent back to LLM -> LLM generates human-friendly summary.
- **Prompting Strategy:** Explicitly tell the LLM how to handle the "Order-to-Cash" flow (e.g., "To find unbilled orders, join orders with deliveries and check for missing invoices").

**[STOP - WAIT FOR USER TO PROVIDE LLM API KEY & TEST]**

---

## 💬 SECTION 5: CONVERSATIONAL CHAT UI

**Goal:** A ChatGPT-like sidebar for data querying.

- Create `components/ChatInterface.tsx`.
- **Features:**
    - Message history (User & AI bubbles).
    - Auto-scrolling to bottom.
    - Loading states (skeleton or spinner) while the LLM/SQL is running.
    - **Actionable Feedback:** If the SQL returns no results, the AI should explain _why_ based on the data schema.
- Add this to the right 30% of `app/page.tsx`.

**[STOP - WAIT FOR USER TO TEST QUERY: "Which products have the most bills?"]**

---

## 🛡️ SECTION 6: GUARDRAILS & TRACING

**Goal:** Secure the app and satisfy the "Tracing" requirement.

- **Guardrail Implementation:** Add a pre-processor to the Chat API. If the prompt is about "Poems", "General History", or "Javascript", return: _"This system is designed to answer questions related to the Order-to-Cash dataset only."_
- **Trace Feature:** Create a specialized "Trace" prompt logic. If a user asks to "Trace Order X", the LLM should generate a recursive SQL query or a series of JOINs that follows the flow from Order -> Delivery -> Invoice -> Payment.
- **UI Highlight:** (Optional/Bonus) When a user asks about a specific ID, highlight that node in the graph.

**[STOP - WAIT FOR USER TO TEST "Write a poem" (Should fail)]**

---

## 🚀 SECTION 7: PRODUCTION POLISH & LOGS

**Goal:** Prepare for submission.

- **README Generation:** Generate a `README.md` that explains:
    - The Graph-Relational hybrid approach.
    - The LLM Text-to-SQL logic.
    - The chosen tech stack justifications.
- **Final Debug:** Check for console errors or memory leaks in the Force Graph.
- **Log Export:** Help the user export all chat logs from this session into a `transcripts.md` or `.zip` file.
- **Vercel Config:** Ensure the `database.db` is path-resolved correctly for deployment (`path.join(process.cwd(), 'data.db')`).

**[FINAL COMPLETION - WAIT FOR SUBMISSION APPROVAL]**

---

## 🛠️ TROUBLESHOOTING & RECOVERY (Reference if AI gets stuck)

- **SQL Error:** "If SQLite throws a 'no such column' error, immediately re-verify the table schema and feed the correct schema back into the LLM prompt."
- **Hydration Error:** "If Next.js throws a hydration error on the graph, ensure it is wrapped in a `useEffect` or `dynamic()` with `ssr: false`."
- **API Timeout:** "If the LLM is slow, implement a 30-second timeout and suggest the user try a simpler query."
