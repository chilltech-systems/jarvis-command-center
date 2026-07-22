"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { Activity, Bot, Check, ChevronDown, CircleDot, Mic, PlugZap, Send, ShieldCheck, Sparkles, X, XCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import type { AssistantApproval, JarvisIntegration, JarvisToolDefinition } from "@/lib/jarvis/types";

type Position = { x: number; y: number };
type Message = { id: string; role: "ava" | "user"; content: string; tool?: JarvisToolDefinition; approval?: AssistantApproval };
type ActivityItem = { activity_id: string; summary: string; status: string; created_at: string };
type DashboardContext = {
  path: string;
  pageLabel: string;
  taskSummary: { total: number; overdue: number; today: number; upcoming: number; completedToday: number };
  automationSummary: { openIssues: number; errorsToday: number };
  connectionSummary: { connected: number; total: number };
};
type TrendContext = { snapshotCount: number; latestMemoryKey: string | null; summary: string[] };
type CapabilitySummary = {
  readyCount: number;
  approvalRequiredCount: number;
  plannedCount: number;
  blockedCount: number;
  ready: string[];
  approvalRequired: string[];
  planned: string[];
  blocked: string[];
};
type AssistantBootstrap = {
  tools: JarvisToolDefinition[];
  integrations: Array<JarvisIntegration & { credentialsReady: boolean }>;
  dashboardContext?: DashboardContext;
  trendContext?: TrendContext;
  capabilitySummary?: CapabilitySummary;
  activity: ActivityItem[];
  approvals: Array<{ approval_id: string; action: string; target: string; expected_result: string; status: string }>;
  conversationId: string | null;
  messages: Array<{ message_id: string; role: "user" | "assistant"; content: string; metadata?: { tool?: string; approval?: AssistantApproval } }>;
  avaContext?: { revision: string; freshness: "fresh" | "stale" | "fallback"; sourceAgeMs: number };
  sourceHealth?: Array<{ source: string; status: string; lastError: string | null; ageMs: number | null }>;
  executionBudget?: { dailyLimit: number; reservedExecutions: number; remainingExecutions: number; stopEngaged: boolean; categories: Record<string, number> };
};

const ORB_SIZE = 62;
const STORAGE_KEY = "ava-orb-position-v1";

function clampPosition(position: Position) {
  return {
    x: Math.min(Math.max(12, position.x), Math.max(12, window.innerWidth - ORB_SIZE - 12)),
    y: Math.min(Math.max(76, position.y), Math.max(76, window.innerHeight - ORB_SIZE - 12)),
  };
}

function savedPosition(): Position {
  const fallback = { x: window.innerWidth - ORB_SIZE - 24, y: window.innerHeight - ORB_SIZE - 28 };
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return clampPosition(saved ? JSON.parse(saved) : fallback);
  } catch {
    return clampPosition(fallback);
  }
}

function toolGroups(tools: JarvisToolDefinition[]) {
  return {
    ready: tools.filter((tool) => tool.status === "available" && tool.permission !== "requires_approval"),
    approval: tools.filter((tool) => tool.status === "available" && tool.permission === "requires_approval"),
    planned: tools.filter((tool) => tool.status === "planned"),
    blocked: tools.filter((tool) => tool.status === "credential_needed"),
  };
}

export function AvaAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "activity" | "integrations">("chat");
  const [position, setPosition] = useState<Position | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<AssistantBootstrap | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "ava", content: "I am here, Cody. Ask me what needs attention, what failed, or which system I should keep closest." },
  ]);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPosition(savedPosition()));
    const resize = () => setPosition((current) => current ? clampPosition(current) : current);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    if (!open || bootstrap) return;
    fetch(`/api/jarvis/assistant?path=${encodeURIComponent(pathname)}`).then((response) => response.ok ? response.json() : null).then((data: AssistantBootstrap | null) => {
      if (!data) return;
      setBootstrap(data);
      setConversationId(data.conversationId);
      if (data.messages.length) {
        setMessages(data.messages.map((message) => ({
          id: message.message_id,
          role: message.role === "assistant" ? "ava" : "user",
          content: message.content,
          approval: message.metadata?.approval,
          tool: data.tools.find((tool) => tool.name === message.metadata?.tool),
        })));
      }
    });
  }, [open, bootstrap, pathname]);

  if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/unauthorized") || !position) return null;

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!position) return;
    drag.current = { pointerId: event.pointerId, offsetX: event.clientX - position.x, offsetY: event.clientY - position.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!position || !drag.current || drag.current.pointerId !== event.pointerId) return;
    const next = clampPosition({ x: event.clientX - drag.current.offsetX, y: event.clientY - drag.current.offsetY });
    if (Math.abs(next.x - position.x) > 3 || Math.abs(next.y - position.y) > 3) drag.current.moved = true;
    setPosition(next);
  }

  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    if (!drag.current.moved) setOpen(true);
    drag.current = null;
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: message }]);

    const response = await fetch("/api/jarvis/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationId, dashboardPath: pathname }),
    });
    const data = await response.json();
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: "ava",
      content: response.ok ? data.message : data.error ?? "I could not process that request.",
      tool: data.tool,
      approval: data.approval,
    }]);
    if (data.conversationId) setConversationId(data.conversationId);
    setBootstrap((current) => current ? {
      ...current,
      dashboardContext: data.dashboardContext ?? current.dashboardContext,
      trendContext: data.trendContext ?? current.trendContext,
      capabilitySummary: data.capabilitySummary ?? current.capabilitySummary,
      avaContext: data.avaContext ?? current.avaContext,
      sourceHealth: data.sourceHealth ?? current.sourceHealth,
      executionBudget: data.executionBudget ?? current.executionBudget,
    } : null);
    setBusy(false);
  }

  async function decideApproval(approvalId: string | undefined, status: "approved" | "denied") {
    if (!approvalId) return;
    const response = await fetch("/api/jarvis/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, status }),
    });
    const data = await response.json().catch(() => ({}));
    const decision = response.ok
      ? data.message ?? `Decision recorded: ${status}.`
      : data.error ?? "I could not record that approval decision.";
    setMessages((current) => current.map((message) => message.approval?.id === approvalId ? { ...message, approval: undefined, content: decision } : message));
    setBootstrap(null);
  }

  const groups = toolGroups(bootstrap?.tools || []);
  const context = bootstrap?.dashboardContext;
  const trends = bootstrap?.trendContext;
  const pendingApprovals = bootstrap?.approvals.length ?? 0;

  return (
    <>
      <button
        type="button"
        className={`ava-orb ${open ? "assistant-open" : ""}`}
        aria-label="Open Ask Ava"
        suppressHydrationWarning
        style={{ left: position.x, top: position.y }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
      >
        <span className="ava-orb-core"><Sparkles size={20} /></span>
      </button>
      <div className={`assistant-scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`assistant-panel ${open ? "open" : ""}`} aria-hidden={!open}>
        <header className="assistant-header">
          <div>
            <div className="eyebrow">Personal operating system</div>
            <h2><Bot size={20} /> Ask Ava</h2>
            <p>{context ? `I am looking at ${context.pageLabel} with live dashboard context.` : "I am loading the current dashboard context."}</p>
          </div>
          <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close Ask Ava"><X size={18} /></button>
        </header>
        <div className="assistant-status">
          <span><CircleDot size={12} /> {context?.pageLabel || "Dashboard"}</span>
          <span><ShieldCheck size={12} /> {pendingApprovals} pending approvals</span>
          <span><Sparkles size={12} /> {trends?.snapshotCount ?? 0} memory snapshots</span>
          <span><CircleDot size={12} /> {bootstrap?.avaContext?.freshness || "loading"} Core context</span>
        </div>
        <div className="assistant-context-strip" aria-label="Ava context and tool capabilities">
          <span>Ready {groups.ready.length}</span>
          <span>Approval {groups.approval.length}</span>
          <span>Planned {groups.planned.length}</span>
          <span>Blocked {groups.blocked.length}</span>
          {context && <span>Tasks {context.taskSummary.total}</span>}
          {context && <span>Overdue {context.taskSummary.overdue}</span>}
          {context && <span>Issues {context.automationSummary.openIssues}</span>}
          {bootstrap?.executionBudget && <span>n8n budget {bootstrap.executionBudget.remainingExecutions}/{bootstrap.executionBudget.dailyLimit}</span>}
        </div>
        <nav className="assistant-tabs">
          <button type="button" className={activeTab === "chat" ? "active" : ""} onClick={() => setActiveTab("chat")}><Bot size={14} /> Assistant</button>
          <button type="button" className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}><Activity size={14} /> Activity</button>
          <button type="button" className={activeTab === "integrations" ? "active" : ""} onClick={() => setActiveTab("integrations")}><PlugZap size={14} /> Systems</button>
        </nav>

        {activeTab === "chat" && <div className="assistant-chat">
          <div className="assistant-messages">
            {context && <article className="assistant-context-card">
              <div><strong>{context.pageLabel}</strong><span>{context.taskSummary.today} due today · {context.taskSummary.overdue} overdue · {context.connectionSummary.connected}/{context.connectionSummary.total} connected</span></div>
              <p>{trends?.summary.slice(0, 2).join(" · ") || "I am building trend memory from daily snapshots."}</p>
            </article>}
            {messages.map((message) => <article key={message.id} className={`assistant-message ${message.role}`}>
              <div className="message-role">{message.role === "ava" ? "AVA" : "CODY"}</div>
              <p>{message.content}</p>
              {message.tool && <div className="tool-chip"><CircleDot size={11} /> {message.tool.name} · {message.tool.permission}</div>}
              {message.approval && <div className="approval-card">
                <div className="approval-title"><ShieldCheck size={14} /> Approval required</div>
                <dl><dt>Action</dt><dd>{message.approval.action}</dd><dt>Target</dt><dd>{message.approval.target}</dd><dt>Expected result</dt><dd>{message.approval.expectedResult}</dd></dl>
                <div className="approval-actions"><button type="button" onClick={() => decideApproval(message.approval?.id, "approved")}><Check size={13} /> Approve</button><button type="button" onClick={() => decideApproval(message.approval?.id, "denied")}><XCircle size={13} /> Deny</button></div>
              </div>}
            </article>)}
            {busy && <article className="assistant-message ava"><div className="message-role">AVA</div><p className="typing">I am checking that now</p></article>}
          </div>
          <form className="assistant-composer" onSubmit={sendMessage}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask me what needs attention..." maxLength={4000} />
            <button type="button" className="voice-button" disabled title="Voice architecture reserved for a future phase"><Mic size={16} /></button>
            <button type="button" className="send-button" disabled={busy || !input.trim()} onClick={() => sendMessage()} aria-label="Send request to Ava"><Send size={16} /></button>
          </form>
        </div>}

        {activeTab === "activity" && <div className="assistant-scroll">
          <div className="assistant-section-title"><span>Activity log</span><span>{bootstrap?.activity.length ?? 0}</span></div>
          {bootstrap?.activity.length ? bootstrap.activity.map((item) => <div className="assistant-list-item" key={item.activity_id}><Activity size={14} /><div><strong>{item.summary}</strong><span>{item.status}</span></div></div>) : <div className="assistant-empty">I will show activity here as I search, draft, request approval, and execute approved tools.</div>}
        </div>}

        {activeTab === "integrations" && <div className="assistant-scroll">
          <div className="assistant-section-title"><span>Tool capabilities</span><span>{bootstrap?.tools.length ?? 0}</span></div>
          <div className="tool-group-grid">
            <div><strong>Ready</strong><span>{groups.ready.map((tool) => tool.name).join(", ") || "None"}</span></div>
            <div><strong>Approval</strong><span>{groups.approval.map((tool) => tool.name).join(", ") || "None"}</span></div>
            <div><strong>Planned</strong><span>{groups.planned.map((tool) => tool.name).join(", ") || "None"}</span></div>
            <div><strong>Blocked</strong><span>{groups.blocked.map((tool) => tool.name).join(", ") || "None"}</span></div>
          </div>
          <div className="assistant-section-title"><span>Integration inventory</span><span>{bootstrap?.integrations.length ?? 0}</span></div>
          {bootstrap?.sourceHealth?.map((source) => <div className="integration-item" key={source.source}><div><strong>{source.source}</strong><span>{source.lastError || (source.ageMs == null ? "No freshness data" : `Updated ${Math.round(source.ageMs / 60000)}m ago`)}</span></div><span className={`integration-status ${source.status}`}>{source.status}</span></div>)}
          {bootstrap?.integrations.map((integration) => <div className="integration-item" key={integration.key}><div><strong>{integration.name}</strong><span>{integration.category} · {integration.permission}</span></div><span className={`integration-status ${integration.status.toLowerCase().replaceAll(" ", "-")}`}>{integration.credentialsReady ? "Connected" : integration.status}</span></div>)}
          <button type="button" className="assistant-collapse" onClick={() => setActiveTab("chat")}><ChevronDown size={14} /> Return to assistant</button>
        </div>}
      </aside>
    </>
  );
}
