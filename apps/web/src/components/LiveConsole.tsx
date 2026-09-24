import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkflowEvent } from '../types';

/**
 * Live agent console: a scrolling feed of what the engine is actually doing,
 * agent by agent, with the reasoning surfaced as "thinking" lines. Polled
 * events come from ce_stage_events (stage, event_type, message, data).
 */

interface AgentMeta {
  label: string;
  color: string;
}

const AGENTS: Record<string, AgentMeta> = {
  validator: { label: 'Angle Validator', color: '#a78bfa' },
  researcher: { label: 'Researcher', color: '#38bdf8' },
  research_review: { label: 'Research Review', color: '#fbbf24' },
  spec_builder: { label: 'Spec Builder', color: '#818cf8' },
  sowhat: { label: 'Demand Gate', color: '#f472b6' },
  pov: { label: 'Proprietary POV', color: '#34d399' },
  writer: { label: 'Writer', color: '#fbbf24' },
  editor: { label: 'Editor', color: '#f87171' },
  complete: { label: 'Complete', color: '#10b981' },
  error: { label: 'Error', color: '#ef4444' },
};

const FALLBACK: AgentMeta = { label: 'Engine', color: '#9ca3af' };

function meta(stage: string): AgentMeta {
  return AGENTS[stage] ?? FALLBACK;
}

/** Inline chips for the useful bits of an event's data payload. */
function chips(ev: WorkflowEvent): string[] {
  const d = ev.data;
  if (!d || typeof d !== 'object') return [];
  const out: string[] = [];
  const g = (k: string) => (d as Record<string, unknown>)[k];
  const decision = g('decision');
  if (typeof decision === 'string') out.push(`decision: ${decision}`);
  const demand = g('demand_score');
  if (typeof demand === 'number') out.push(`demand ${(demand * 100).toFixed(0)}%`);
  const confidence = g('confidence');
  if (typeof confidence === 'number') out.push(`confidence ${(confidence * 100).toFixed(0)}%`);
  const missing = g('missing');
  if (Array.isArray(missing) && missing.length) out.push(`missing: ${missing.join(', ')}`);
  const queries = g('queries');
  if (Array.isArray(queries)) out.push(`${queries.length} queries`);
  const entries = g('entries_used');
  if (Array.isArray(entries) && entries.length) out.push(`${entries.length} layer entr${entries.length === 1 ? 'y' : 'ies'}`);
  if (g('has_experience') === false) out.push('no layer entry');
  if (typeof g('steer') === 'string' && g('steer')) out.push(`steer: ${g('steer') as string}`);
  const pass = g('pass');
  if (typeof pass === 'boolean') out.push(pass ? 'gate PASS' : 'gate BELOW BAR');
  return out;
}

function EventRow({ ev, isNewest }: { ev: WorkflowEvent; isNewest: boolean }) {
  const m = meta(ev.stage);
  const time = new Date(ev.created_at).toLocaleTimeString([], { hour12: false });
  const c = chips(ev);
  const cls =
    ev.event_type === 'error'
      ? ' err'
      : ev.event_type === 'stage_end'
        ? ' done'
        : ev.event_type === 'thinking'
          ? ' think'
          : ev.event_type === 'llm_call'
            ? ' llm'
            : ev.event_type === 'stage_start'
              ? ' start'
              : '';

  return (
    <div className={`lc-row${cls}${isNewest ? ' newest' : ''}`}>
      <span className="lc-time">{time}</span>
      <span className="lc-agent" style={{ color: m.color }}>
        {m.label}
      </span>
      <span className="lc-mark">
        {ev.event_type === 'stage_start'
          ? '▸'
          : ev.event_type === 'stage_end'
            ? '✓'
            : ev.event_type === 'error'
              ? '✕'
              : ev.event_type === 'thinking'
                ? '✳'
                : ev.event_type === 'llm_call'
                  ? '◦'
                  : '·'}
      </span>
      <span className="lc-msg">
        {ev.event_type === 'llm_call'
          ? `${ev.message}${ev.tokens_in != null ? ` · ${ev.tokens_in}/${ev.tokens_out} tok` : ''}${ev.cost_usd ? ` · $${ev.cost_usd.toFixed(4)}` : ''}${ev.latency_ms ? ` · ${(ev.latency_ms / 1000).toFixed(1)}s` : ''}`
          : ev.message}
        {c.length ? (
          <span className="lc-chips">
            {c.map((chip, i) => (
              <span className="lc-chip" key={i}>
                {chip}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export default function LiveConsole({
  events,
  status,
  currentStage,
  costSummary,
}: {
  events: WorkflowEvent[];
  status: string;
  currentStage: string;
  costSummary: { cost: number; tokensIn: number; tokensOut: number } | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [, forceTick] = useState(0);

  const isRunning = (s: string) => s !== 'complete' && s !== 'error' && s !== 'killed' && s !== 'pivot';
  const running = isRunning(status);

  // Elapsed timer — recompute every second while running.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Auto-scroll to the newest line while the user is pinned to the bottom.
  useEffect(() => {
    if (pinned && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [events.length, pinned]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };

  // The latest thought — the "now thinking" ticker.
  const latestThought = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.event_type === 'thinking' || ev.event_type === 'step_progress') return ev;
    }
    return events.length ? events[events.length - 1] : null;
  }, [events]);

  const elapsed = useMemo(() => {
    if (!events.length) return 0;
    const start = new Date(events[0].created_at).getTime();
    const last = running ? Date.now() : new Date(events[events.length - 1].created_at).getTime();
    return Math.max(0, Math.round((last - start) / 1000));
  }, [events, running, forceTick]);

  const currentMeta = meta(currentStage);

  return (
    <div className="live-console">
      <div className="lc-head">
        <span className="lc-dot" style={{ background: running ? currentMeta.color : '#10b981', animation: running ? 'lc-pulse 1.4s ease-in-out infinite' : undefined }} />
        <strong>{running ? currentMeta.label : status === 'complete' ? 'Complete' : status === 'awaiting_review' ? 'Awaiting your review' : 'Run finished'}</strong>
        <span className="lc-spacer" />
        <span className="lc-meta">{elapsed}s</span>
        {costSummary && costSummary.cost > 0 ? (
          <span className="lc-meta">
            ${costSummary.cost.toFixed(4)} · {(costSummary.tokensIn + costSummary.tokensOut).toLocaleString()} tok
          </span>
        ) : null}
        {!pinned ? (
          <button className="lc-jump" onClick={() => setPinned(true)}>
            jump to live ↓
          </button>
        ) : null}
      </div>

      {latestThought ? (
        <div className="lc-now">
          <span className="lc-now-tag" style={{ color: meta(latestThought.stage).color }}>
            {meta(latestThought.stage).label}
          </span>
          <span className="lc-now-msg">{latestThought.message}</span>
          {running ? <span className="lc-caret" /> : null}
        </div>
      ) : null}

      <div className="lc-feed" ref={boxRef} onScroll={onScroll}>
        {events.length === 0 ? (
          <div className="lc-row">
            <span className="lc-msg lc-dim">Waiting for the first event…</span>
          </div>
        ) : (
          events.map((ev, i) => <EventRow key={i} ev={ev} isNewest={i === events.length - 1 && running} />)
        )}
      </div>
    </div>
  );
}