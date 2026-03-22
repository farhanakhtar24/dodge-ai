"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Plus, MessageSquare, ChevronDown, ChevronRight, AlertCircle, Trash2, ArrowLeft, Loader2, Pencil, Check, X } from "lucide-react";
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
  row_count?: number;
  is_guardrail?: boolean;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  updated_at?: string;
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
  return msg.length > 40 ? msg.slice(0, 40) + "…" : msg;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

function SessionItem({ session, active, onClick, onDelete, onRename }: {
  session: ChatSession; active: boolean;
  onClick: () => void; onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(session.title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.title) onRename(trimmed);
    setEditing(false);
  };

  const cancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e as unknown as React.KeyboardEvent);
            if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
          }}
          className="flex-1 text-sm bg-transparent outline-none min-w-0"
          autoFocus
        />
        <button onClick={commit} className="p-0.5 hover:text-green-600"><Check className="w-3 h-3" /></button>
        <button onClick={cancel} className="p-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{session.title}</span>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
        <button onClick={startEdit} className="p-0.5 hover:text-foreground">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 hover:text-destructive">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChatInterface({ onReferencedIds }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount
  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: ChatSession[]) => {
        setSessions(data);
        setLoadingSessions(false);
      })
      .catch(() => setLoadingSessions(false));
  }, []);

  // Load messages when switching session
  const openSession = useCallback(async (id: string) => {
    setActiveId(id);
    setShowSidebar(false);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json() as ChatMessage[];
      setMessages(data);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const activeSession = sessions.find((s) => s.id === activeId);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !activeId) return;
    setInput("");
    setIsLoading(true);

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    // Auto-title session on first message
    if (messages.length === 0) {
      const title = titleFromMessage(text);
      setSessions((prev) => prev.map((s) => s.id === activeId ? { ...s, title } : s));
      fetch(`/api/sessions/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => {});
    }

    const assistantId = uid();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", isStreaming: true }]);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: text });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, sessionId: activeId }),
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
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: cleanText(fullText) } : m
          ));
        }
      }

      const ids = extractReferencedIds(fullText);
      if (ids.length > 0) onReferencedIds(ids);

      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: cleanText(fullText), sql, row_count: rowCount, is_guardrail: isGuardrail, isStreaming: false }
          : m
      ));

      // Bump session to top
      setSessions((prev) => {
        const s = prev.find((x) => x.id === activeId);
        if (!s) return prev;
        return [{ ...s, updated_at: new Date().toISOString() }, ...prev.filter((x) => x.id !== activeId)];
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: `Error: ${msg}`, isStreaming: false } : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeId, messages, onReferencedIds]);

  const newChat = async () => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    const session = await res.json() as ChatSession;
    setSessions((prev) => [session, ...prev]);
    setMessages([]);
    setActiveId(session.id);
    setShowSidebar(false);
  };

  const renameSession = async (id: string, title: string) => {
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s));
  };

  const deleteSession = async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
      setShowSidebar(true);
    }
  };

  // ── Sessions list view ─────────────────────────────────────────────────────
  if (showSidebar || !activeId) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <span className="text-sm font-semibold">Chats</span>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={newChat}>
            <Plus className="w-3 h-3" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1 px-3 py-3">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No chats yet. Start one!</p>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  active={s.id === activeId}
                  onClick={() => openSession(s.id)}
                  onDelete={() => deleteSession(s.id)}
                  onRename={(title) => renameSession(s.id, title)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // ── Active chat view ───────────────────────────────────────────────────────
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
          <p className="text-sm font-semibold truncate">{activeSession?.title ?? "Chat"}</p>
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
        {loadingMessages ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
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
                    {msg.is_guardrail && (
                      <div className="flex items-center gap-1 text-amber-500 mb-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Out of scope</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                      {msg.isStreaming && <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse" />}
                    </p>
                    {msg.row_count !== undefined && !msg.is_guardrail && !msg.isStreaming && (
                      <Badge variant="secondary" className="mt-1.5 text-xs">
                        {msg.row_count} row{msg.row_count !== 1 ? "s" : ""}
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
          </>
        )}
      </ScrollArea>

      {/* Status */}
      <div className="px-4 py-2 border-t flex items-center gap-1.5 shrink-0">
        <span className={cn("w-2 h-2 rounded-full", isLoading ? "bg-amber-400 animate-pulse" : "bg-green-400")} />
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Dodge AI is thinking..." : "Dodge AI is awaiting instructions"}
        </span>
      </div>

      {/* Suggestion pills */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 shrink-0 flex flex-wrap gap-1.5">
          {[
            "Top 10 sales orders by amount",
            "Undelivered sales orders",
            "Unpaid billing documents",
            "Cancelled billing documents",
            "Most ordered products",
            "Orders delivered but not billed",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

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
            rows={3}
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
