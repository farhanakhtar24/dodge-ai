import { streamText } from "ai";
import sql from "@/lib/db";
import { generateSQL, fixSQL, isOffTopic, MODEL, SYSTEM_PROMPT } from "@/lib/llm-service";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function saveUserMessage(sessionId: string, content: string) {
  await sql`INSERT INTO chat_messages (id, session_id, role, content) VALUES (${uid()}, ${sessionId}, 'user', ${content})`;
  await sql`UPDATE chat_sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
}

async function saveAssistantMessage(
  sessionId: string,
  content: string,
  sqlQuery: string,
  rowCount: number,
  isGuardrail: boolean
) {
  await sql`
    INSERT INTO chat_messages (id, session_id, role, content, sql, row_count, is_guardrail)
    VALUES (${uid()}, ${sessionId}, 'assistant', ${content}, ${sqlQuery || null}, ${rowCount}, ${isGuardrail ? 1 : 0})
  `;
  await sql`UPDATE chat_sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
}

const tryExecute = async (q: string): Promise<{ rows: Record<string, unknown>[]; error: string }> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (sql as any)(q) as Record<string, unknown>[];
    return { rows, error: "" };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
};

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json() as {
    messages: { role: string; content: string }[];
    sessionId?: string;
  };
  const lastMessage = messages[messages.length - 1]?.content as string;

  if (!lastMessage) return new Response("Missing message", { status: 400 });

  if (sessionId) await saveUserMessage(sessionId, lastMessage);

  const hasContext = messages.slice(0, -1).some((m) => m.role === "assistant");
  if (await isOffTopic(lastMessage, hasContext)) {
    const result = streamText({
      model: MODEL,
      prompt: "Reply with exactly: This system is designed to answer questions related to the Order-to-Cash dataset only.",
      onFinish: async ({ text }) => {
        if (sessionId) await saveAssistantMessage(sessionId, text, "", 0, true);
      },
    });
    return result.toTextStreamResponse({
      headers: { "X-Is-Guardrail": "true", "X-SQL": "", "X-Row-Count": "0" },
    });
  }

  // Step 1 — generate + execute SQL (with self-heal on both errors AND 0 rows)
  let query = "";
  let results: Record<string, unknown>[] = [];

  const history = messages.slice(0, -1);
  query = await generateSQL(lastMessage, history);
  let attempt = await tryExecute(query);

  if (attempt.error || attempt.rows.length === 0) {
    const fixedSql = await fixSQL(query, lastMessage, attempt.error);
    if (fixedSql !== query) {
      const fixedAttempt = await tryExecute(fixedSql);
      if (!fixedAttempt.error && fixedAttempt.rows.length >= attempt.rows.length) {
        query = fixedSql;
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
- State only what the data limitation is (e.g. "no records found").
- Keep the response to 1-2 sentences.`;

  const result = streamText({
    model: MODEL,
    system: SYSTEM_PROMPT,
    prompt: answerPrompt,
    onFinish: async ({ text }) => {
      if (sessionId) await saveAssistantMessage(sessionId, text, query, results.length, false);
    },
  });

  return result.toTextStreamResponse({
    headers: {
      "X-SQL": encodeURIComponent(query),
      "X-Row-Count": String(results.length),
      "X-SQL-Error": attempt.error,
    },
  });
}
