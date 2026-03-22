import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const messages = db.prepare(
    "SELECT id, role, content, sql, row_count, is_guardrail, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC"
  ).all(id);
  return NextResponse.json(messages);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title } = await req.json();
  const db = getDb();
  db.prepare(
    "UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(title, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
