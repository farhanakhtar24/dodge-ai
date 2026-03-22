"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Plus, MessageSquare, ChevronDown, ChevronRight, AlertCircle, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  rowCount?: number;
  isGuardrail?: boolean;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
}

interface Props {
  onReferencedIds: (ids: string[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractReferencedIds(text: string): string[] {
  try {
    const match = text.match(/\{"referencedIds"\s*:\s*(\[[^\]]*\])\}/);
    if (match) return JSON.parse(match[1]) as string[];
  } catch { /* ignore */ }
  return [];
}

function cleanText(text: string): string {
  return text.replace(/\{"referencedIds"\s*:\s*\[[^\]]*\]\}/, "").trim();
}

function titleFromMessage(msg: string): string {
  return msg.length > 36 ? msg.slice(0, 36) + "…" : msg;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        SQL used
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-gray-900 text-green-300 text-xs rounded-md overflow-x-auto whitespace-pre-wrap">
          {sql}
        </pre>
      )}
    </div>
  );
}

function SessionItem({ session, active, onClick, onDelete }: {
  session: ChatSession; active: boolean;
  onClick: () => void; onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{session.title}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChatInterface({ onReferencedIds }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: "1", title: "New Chat", messages: [] },
  ]);
  const [activeId, setActiveId] = useState("1");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId)!;
  const messages = activeSession.messages;

  // Auto-hide sidebar when chat has messages
  useEffect(() => {
    if (messages.length > 0) setShowSidebar(false);
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    setIsLoading(true);

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };

    // Auto-title session
    setSessions((prev) => prev.map((s) =>
      s.id === activeId && s.title === "New Chat"
        ? { ...s, title: titleFromMessage(text), messages: [...s.messages, userMsg] }
        : s.id === activeId
        ? { ...s, messages: [...s.messages, userMsg] }
        : s
    ));

    const assistantId = uid();
    setSessions((prev) => prev.map((s) =>
      s.id === activeId
        ? { ...s, messages: [...s.messages, { id: assistantId, role: "assistant", content: "", isStreaming: true }] }
        : s
    ));

    try {
      // Build history for context
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: text });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const sql = decodeURIComponent(res.headers.get("X-SQL") || "");
      const rowCount = parseInt(res.headers.get("X-Row-Count") || "0");
      const isGuardrail = res.headers.get("X-Is-Guardrail") === "true";

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          const current = fullText;
          setSessions((prev) => prev.map((s) =>
            s.id === activeId
              ? { ...s, messages: s.messages.map((m) => m.id === assistantId ? { ...m, content: cleanText(current) } : m) }
              : s
          ));
        }
      }

      // Extract referenced IDs
      const ids = extractReferencedIds(fullText);
      if (ids.length > 0) onReferencedIds(ids);

      // Finalise message with metadata
      setSessions((prev) => prev.map((s) =>
        s.id === activeId
          ? {
              ...s, messages: s.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: cleanText(fullText), sql, rowCount, isGuardrail, isStreaming: false }
                  : m
              ),
            }
          : s
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSessions((prev) => prev.map((s) =>
        s.id === activeId
          ? { ...s, messages: s.messages.map((m) => m.id === assistantId ? { ...m, content: `Error: ${msg}`, isStreaming: false } : m) }
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeId, messages, onReferencedIds]);

  const newChat = () => {
    const id = uid();
    setSessions((prev) => [...prev, { id, title: "New Chat", messages: [] }]);
    setActiveId(id);
    setShowSidebar(true); // show sidebar for empty new chat
  };

  const deleteSession = (id: string) => {
    if (sessions.length === 1) return;
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeId === id) setActiveId(remaining[remaining.length - 1].id);
  };

  // ── Sessions list view (full-width) ─────────────────────────────────────────
  if (showSidebar) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Chats</span>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={newChat}>
            <Plus className="w-3 h-3" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-1">
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeId}
                onClick={() => { setActiveId(s.id); setShowSidebar(false); }}
                onDelete={() => deleteSession(s.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── Active chat view (full-width) ─────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0">
        <button
          onClick={() => setShowSidebar(true)}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent transition-colors"
          title="Back to chats"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Separator orientation="vertical" className="h-4" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Chat with Graph</p>
            <p className="text-sm font-semibold truncate">{activeSession.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground text-background rounded-full flex items-center justify-center text-xs font-bold">D</div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold leading-none">Dodge AI</p>
              <p className="text-xs text-muted-foreground">Graph Agent</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0 px-4 py-4">
          {messages.length === 0 && (
            <div className="flex justify-start mb-4">
              <div className="max-w-[85%] bg-muted rounded-2xl px-3 py-2 text-sm leading-relaxed">
                Hi! I can help you analyze the <strong>Order to Cash</strong> process. Ask me about sales orders, deliveries, billing documents, payments, or trace any document through the full flow.
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}>
                  {msg.isGuardrail && (
                    <div className="flex items-center gap-1 text-amber-500 mb-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Out of scope</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                    {msg.isStreaming && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse" />}
                  </p>
                  {msg.rowCount !== undefined && !msg.isGuardrail && !msg.isStreaming && (
                    <Badge variant="secondary" className="mt-1.5 text-xs">
                      {msg.rowCount} row{msg.rowCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {msg.sql && !msg.isStreaming && <SqlBlock sql={msg.sql} />}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3 py-2">
                  <span className="inline-flex gap-1 items-center h-5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Status */}
        <div className="px-4 py-2 border-t flex items-center gap-1.5 shrink-0">
          <span className={cn("w-2 h-2 rounded-full", isLoading ? "bg-amber-400 animate-pulse" : "bg-green-400")} />
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Dodge AI is thinking..." : "Dodge AI is awaiting instructions"}
          </span>
        </div>

        {/* Input */}
        <div className="px-4 pb-4 shrink-0">
          <div className="flex flex-col gap-2 border rounded-xl p-3 focus-within:ring-1 focus-within:ring-ring bg-background">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Analyze anything"
              rows={4}
              className="resize-none border-0 p-0 shadow-none focus-visible:ring-0 text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Enter to send · Shift+Enter for newline</p>
              <Button size="sm" disabled={!input.trim() || isLoading} onClick={sendMessage}>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Send
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
}
