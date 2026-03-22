import sql from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await sql`
    SELECT id, role, content, sql, row_count, is_guardrail, created_at
    FROM chat_messages WHERE session_id = ${id} ORDER BY created_at ASC
  `;
  return NextResponse.json(messages);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title } = await req.json();
  await sql`UPDATE chat_sessions SET title = ${title}, updated_at = NOW() WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await sql`DELETE FROM chat_sessions WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
