import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMatches } from "@tanstack/react-router";
import { Sparkles, X, Send, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- Minimal markdown renderer -------------------------------------------------------
// Genie returns markdown (## headers, **bold**, bullets, [links](url)); render it
// rather than showing the raw syntax. Small + dependency-free — covers the subset the
// assistant emits. Inline: **bold** and [text](url).
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize on **bold** and [label](url).
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{m[1]}</strong>);
    } else {
      nodes.push(
        <a
          key={`${keyBase}-l${i}`}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline hover:no-underline"
        >
          {m[2]}
        </a>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let tableRows: string[] = [];
  let key = 0;

  const splitCells = (row: string) =>
    row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul${key++}`} className="list-disc pl-5 space-y-1 my-1.5">
        {items.map((b, j) => (
          <li key={j}>{renderInline(b, `li${key}-${j}`)}</li>
        ))}
      </ul>,
    );
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const rows = tableRows;
    tableRows = [];
    // Drop the separator row (|---|---|).
    const body = rows.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r));
    if (body.length === 0) return;
    const header = splitCells(body[0]);
    const dataRows = body.slice(1).map(splitCells);
    blocks.push(
      <div key={`tbl${key++}`} className="my-2 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {header.map((c, j) => (
                <th
                  key={j}
                  className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold align-top"
                >
                  {renderInline(c, `th${key}-${j}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className="border border-border px-2 py-1 align-top">
                    {renderInline(c, `td${key}-${ri}-${ci}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  };

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (isTableRow(line)) {
      flushBullets();
      tableRows.push(line);
      continue;
    }
    // Any non-table line ends a table in progress.
    if (tableRows.length) flushTable();
    if (h) {
      flushBullets();
      const lvl = h[1].length;
      const cls =
        lvl <= 2
          ? "text-sm font-bold mt-3 mb-1"
          : "text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2 mb-1";
      blocks.push(
        <div key={`h${key++}`} className={cls}>
          {renderInline(h[2], `h${key}`)}
        </div>,
      );
    } else if (bullet || numbered) {
      bullets.push((bullet ?? numbered)![1]);
    } else if (line.trim() === "") {
      flushBullets();
    } else {
      flushBullets();
      blocks.push(
        <p key={`p${key++}`} className="my-1.5">
          {renderInline(line, `p${key}`)}
        </p>,
      );
    }
  }
  flushBullets();
  flushTable();
  return <div className="text-sm leading-relaxed">{blocks}</div>;
}

// The chat talks to the backend Genie proxy directly via fetch (rather than the
// generated OpenAPI client) so it stays self-contained and doesn't require a client
// regeneration step. Endpoints: GET /api/genie/status, POST /api/genie/ask.

// Any component can open the panel by firing this event (e.g. the landing-page CTA
// or a per-account "Ask about this account" button) without threading state through
// the tree — the globally-mounted GenieChat listens for it.
export const OPEN_GENIE_EVENT = "open-genie-chat";
export function openGenieChat(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_GENIE_EVENT, { detail: { prompt } }));
}

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  sql?: string | null;
}

interface HistoryEntry {
  id: string;
  question: string;
  answer: string;
  account_name?: string;
  asked_by?: string;
  created_at: string;
}

// Pull the current account id out of the route match params, if we're on an
// account-detail page — so the assistant can tailor answers to that engagement.
function useCurrentAccountId(): string | undefined {
  const matches = useMatches();
  for (const m of matches) {
    const p = m.params as Record<string, string> | undefined;
    if (p?.accountId) return p.accountId;
  }
  return undefined;
}

export function GenieChat() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const accountId = useCurrentAccountId();
  const scrollRef = useRef<HTMLDivElement>(null);

  function openHistory() {
    setShowHistory(true);
    setHistory(null);
    fetch("/api/genie/history")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]));
  }

  // Check once whether a Genie Space is configured; hide the launcher if not.
  useEffect(() => {
    fetch("/api/genie/status")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  // Open (and optionally pre-fill) when another component fires the open event.
  useEffect(() => {
    function onOpen(e: Event) {
      setOpen(true);
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) setInput(prompt);
    }
    window.addEventListener(OPEN_GENIE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GENIE_EVENT, onOpen);
  }, []);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: question }]);
    setBusy(true);
    setStatus("Thinking…");
    try {
      // Stream: server sends newline-delimited JSON — {type:"status"|"answer"}.
      const res = await fetch("/api/genie/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversation_id: conversationId,
          account_id: conversationId ? null : accountId ?? null,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let gotAnswer = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type: string; text?: string; conversation_id?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "status" && ev.text) {
            setStatus(ev.text);
          } else if (ev.type === "answer") {
            if (ev.conversation_id) setConversationId(ev.conversation_id);
            setTurns((t) => [...t, { role: "assistant", text: ev.text ?? "" }]);
            gotAnswer = true;
          }
        }
      }
      if (!gotAnswer) throw new Error("no answer");
    } catch {
      setTurns((t) => [
        ...t,
        { role: "assistant", text: "Sorry — I couldn't reach the assistant just now. Please try again." },
      ]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  function resetConversation() {
    setTurns([]);
    setConversationId(null);
  }

  if (enabled === false) return null;

  return (
    <>
      {/* Launcher — opens the panel. Hidden while open (the header X closes it) so it
          never overlaps the panel's Send button. */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-12 rounded-full shadow-lg gap-2 pl-4 pr-5"
        >
          <Sparkles className="h-4 w-4" />
          Ask Genie
        </Button>
      )}

      {/* Slide-over panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-2xl flex flex-col transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b shrink-0">
          <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center ring-1 ring-black/5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col leading-tight flex-1">
            <span className="text-sm font-semibold">Ask Genie</span>
            <span className="text-xs text-muted-foreground -mt-0.5">
              {accountId ? "Answering for this account" : "Field adoption assistant"}
            </span>
          </div>
          {showHistory ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowHistory(false)}
            >
              Back to chat
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={openHistory}
              >
                <History className="h-3.5 w-3.5" /> History
              </Button>
              {turns.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={resetConversation}>
                  New chat
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <p className="text-sm font-semibold">Ask Genie history</p>
            {history === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No questions asked yet.
              </p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="text-sm font-medium">{h.question}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()}
                    {h.asked_by ? ` · ${h.asked_by}` : ""}
                    {h.account_name ? ` · ${h.account_name}` : ""}
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-primary text-xs">
                      Show answer
                    </summary>
                    <div className="mt-1.5">
                      <Markdown text={h.answer} />
                    </div>
                  </details>
                </div>
              ))
            )}
          </div>
        ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {turns.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-3">
              <p>Ask about FINS Genie adoption, or how to run the play. For example:</p>
              <ul className="space-y-1.5">
                {[
                  "Which accounts have Partner-Powered AI turned off?",
                  "Which accounts are ready for a Genie hackathon?",
                  "What are the prerequisites for a Genie hackathon?",
                  "How should I respond to a cost objection?",
                ].map((q) => (
                  <li key={q}>
                    <button
                      className="text-left rounded-md border px-2.5 py-1.5 hover:bg-accent transition-colors w-full"
                      onClick={() => setInput(q)}
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  t.role === "user"
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-muted text-foreground",
                )}
              >
                {t.role === "assistant" ? <Markdown text={t.text} /> : t.text}
                {t.sql && (
                  <details className="mt-2 text-xs opacity-80">
                    <summary className="cursor-pointer">SQL</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono">{t.sql}</pre>
                  </details>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 bg-muted flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {status || "Thinking…"}
              </div>
            </div>
          )}
        </div>
        )}

        <div className="border-t p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow with content.
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={3}
              placeholder="Ask a question…  (Enter to send, Shift+Enter for a new line)"
              className="flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[72px] max-h-60"
            />
            <Button size="icon" onClick={send} disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default GenieChat;
