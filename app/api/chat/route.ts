import { streamText } from "ai";
import { getDb } from "@/lib/db";
import { generateSQL, fixSQL, isOffTopic, MODEL } from "@/lib/llm-service";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1]?.content as string;

  // Guardrail
  if (isOffTopic(lastMessage)) {
    const result = streamText({
      model: MODEL,
      prompt: "Reply with exactly: This system is designed to answer questions related to the Order-to-Cash dataset only.",
    });
    return result.toTextStreamResponse({
      headers: { "X-Is-Guardrail": "true", "X-SQL": "", "X-Row-Count": "0" },
    });
  }

  // Step 1 — generate + execute SQL
  let sql = "";
  let results: Record<string, unknown>[] = [];
  let sqlError = "";

  try {
    const db = getDb();
    sql = await generateSQL(lastMessage);
    results = db.prepare(sql).all() as Record<string, unknown>[];

    // Self-heal: retry once if 0 rows
    if (results.length === 0) {
      const fixedSql = await fixSQL(sql, lastMessage);
      if (fixedSql !== sql) {
        try {
          const fixedResults = db.prepare(fixedSql).all() as Record<string, unknown>[];
          if (fixedResults.length > 0) { sql = fixedSql; results = fixedResults; }
        } catch { /* keep original */ }
      }
    }
  } catch (err) {
    sqlError = err instanceof Error ? err.message : String(err);
  }

  // Step 2 — stream answer
  let answerPrompt: string;
  if (sqlError) {
    answerPrompt = `The user asked: "${lastMessage}"\n\nSQL failed: ${sqlError}\n\nBriefly explain and suggest a rephrasing.`;
  } else if (results.length === 0) {
    answerPrompt = `The user asked: "${lastMessage}"\n\nSQL ran but returned 0 rows:\n${sql}\n\nExplain why results might be empty and suggest what the user could try instead.`;
  } else {
    answerPrompt = `The user asked: "${lastMessage}"

The database returned ${results.length} rows:
${JSON.stringify(results.slice(0, 50), null, 2)}

Answer the user's question using ONLY this data. Present the actual values (IDs, counts, amounts). Do not say the data is unrelated.
At the end add: {"referencedIds": ["id1","id2"]} listing entity IDs from the results.`;
  }

  const result = streamText({
    model: MODEL,
    system: "You are a data analyst for an Order-to-Cash system. Answer questions using only the provided database results. Always show the actual values.",
    prompt: answerPrompt,
  });

  return result.toTextStreamResponse({
    headers: {
      "X-SQL": encodeURIComponent(sql),
      "X-Row-Count": String(results.length),
      "X-SQL-Error": sqlError,
    },
  });
}
