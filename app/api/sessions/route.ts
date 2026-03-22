import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function GET() {
  const db = getDb();
  const sessions = db.prepare(
    "SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC"
  ).all();
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const { title } = await req.json().catch(() => ({ title: "New Chat" }));
  const db = getDb();
  const id = uid();
  db.prepare(
    "INSERT INTO chat_sessions (id, title) VALUES (?, ?)"
  ).run(id, title ?? "New Chat");
  return NextResponse.json({ id, title: title ?? "New Chat" });
}
