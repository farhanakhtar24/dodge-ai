import { streamText } from "ai";
import { getDb } from "@/lib/db";
import { generateSQL, fixSQL, isOffTopic, MODEL } from "@/lib/llm-service";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Save user message immediately — before any streaming starts
function saveUserMessage(sessionId: string, content: string): string {
  const db = getDb();
  const id = uid();
  db.prepare(
    "INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, 'user', ?)"
  ).run(id, sessionId, content);
  db.prepare(
    "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?"
  ).run(sessionId);
  return id;
}

// Save assistant message after streaming completes
function saveAssistantMessage(
  sessionId: string,
  content: string,
  sql: string,
  rowCount: number,
  isGuardrail: boolean
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO chat_messages (id, session_id, role, content, sql, row_count, is_guardrail)
     VALUES (?, ?, 'assistant', ?, ?, ?, ?)`
  ).run(uid(), sessionId, content, sql || null, rowCount, isGuardrail ? 1 : 0);
  db.prepare(
    "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?"
  ).run(sessionId);
}

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json() as {
    messages: { role: string; content: string }[];
    sessionId?: string;
  };
  const lastMessage = messages[messages.length - 1]?.content as string;

  if (!lastMessage) {
    return new Response("Missing message", { status: 400 });
  }

  // Persist user message immediately so it's never lost
  if (sessionId) saveUserMessage(sessionId, lastMessage);

  // Guardrail
  if (await isOffTopic(lastMessage)) {
    const result = streamText({
      model: MODEL,
      prompt: "Reply with exactly: This system is designed to answer questions related to the Order-to-Cash dataset only.",
      onFinish: ({ text }) => {
        if (sessionId) saveAssistantMessage(sessionId, text, "", 0, true);
      },
    });
    return result.toTextStreamResponse({
      headers: { "X-Is-Guardrail": "true", "X-SQL": "", "X-Row-Count": "0" },
    });
  }

  // Step 1 — generate + execute SQL (with self-heal on both errors AND 0 rows)
  let sql = "";
  let results: Record<string, unknown>[] = [];

  const tryExecute = (q: string): { rows: Record<string, unknown>[]; error: string } => {
    try {
      return { rows: getDb().prepare(q).all() as Record<string, unknown>[], error: "" };
    } catch (e) {
      return { rows: [], error: e instanceof Error ? e.message : String(e) };
    }
  };

  sql = await generateSQL(lastMessage);
  let attempt = tryExecute(sql);

  // Self-heal: retry if SQL errored OR returned 0 rows
  if (attempt.error || attempt.rows.length === 0) {
    const fixedSql = await fixSQL(sql, lastMessage, attempt.error);
    if (fixedSql !== sql) {
      const fixedAttempt = tryExecute(fixedSql);
      if (!fixedAttempt.error && fixedAttempt.rows.length >= attempt.rows.length) {
        sql = fixedSql;
        attempt = fixedAttempt;
      }
    }
  }

  results = attempt.rows;

  // Step 2 — stream answer
  const answerPrompt = results.length > 0
    ? `Question: "${lastMessage}"

Database results (${results.length} rows):
${JSON.stringify(results.slice(0, 50), null, 2)}

STRICT RULES:
- Answer using ONLY the values in the rows above. Do not add, estimate, or infer anything not present in the data.
- Present actual values: IDs, amounts, dates, counts exactly as they appear.
- If a column is null, say "not available" — do not guess what it might be.
- End with: {"referencedIds": ["id1","id2"]} listing IDs from the results.`
    : `Question: "${lastMessage}"

The database returned 0 rows for this query.

STRICT RULES:
- Do NOT make up numbers, estimates, or assumptions.
- State only what the data limitation is (e.g. "no records found", "this linkage is not available in the dataset").
- Do not suggest what the answer "might be" or provide hypothetical figures.
- Keep the response to 1-2 sentences.`;

  const result = streamText({
    model: MODEL,
    system: "You are a data analyst for an SAP Order-to-Cash system. Summarise the database results in clear, natural language. Be concise and data-driven — highlight key numbers, patterns, or notable findings. Never estimate or infer anything not present in the data.",
    prompt: answerPrompt,
    onFinish: ({ text }) => {
      if (sessionId) saveAssistantMessage(sessionId, text, sql, results.length, false);
    },
  });

  return result.toTextStreamResponse({
    headers: {
      "X-SQL": encodeURIComponent(sql),
      "X-Row-Count": String(results.length),
      "X-SQL-Error": attempt.error,
    },
  });
}
