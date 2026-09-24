import { useMemo, useState } from 'react';

export interface FieldConfig {
  key: string;
  label: string;
  kind: 'text' | 'list' | 'number';
  hint?: string;
}

export function parseList(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function toListText(values: unknown): string {
  if (!Array.isArray(values)) return '';
  return values.join('\n');
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Generic structured editor for a JSON section (brand_voice, icp, etc.).
 * Renders inputs/textareas and keeps the underlying object in sync.
 */
export function SectionEditor({
  section,
  fields,
  onChange,
}: {
  section: Record<string, unknown>;
  fields: FieldConfig[];
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [raw, setRaw] = useState<Record<string, string>>({});

  const set = (key: string, value: unknown) => {
    const next = { ...section, [key]: value };
    onChange(next);
  };

  const setListRaw = (key: string, text: string) => {
    setRaw((r) => ({ ...r, [key]: text }));
    set(key, parseList(text));
  };

  return (
    <div>
      {fields.map((f) => {
        const value = section[f.key];
        if (f.kind === 'list') {
          const text = raw[f.key] ?? toListText(value);
          return (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <textarea
                className="input"
                rows={3}
                value={text}
                placeholder="One item per line"
                onChange={(e) => setListRaw(f.key, e.target.value)}
              />
              {f.hint ? <div className="hint">{f.hint}</div> : null}
            </div>
          );
        }
        if (f.kind === 'number') {
          const num = typeof value === 'number' ? value : 0;
          return (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input
                className="input"
                type="number"
                min={0}
                value={num}
                onChange={(e) => set(f.key, parseInt(e.target.value || '0', 10) || 0)}
              />
              {f.hint ? <div className="hint">{f.hint}</div> : null}
            </div>
          );
        }
        return (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input
              className="input"
              value={str(value)}
              onChange={(e) => set(f.key, e.target.value)}
            />
            {f.hint ? <div className="hint">{f.hint}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Live validity: returns list of field keys that are missing/empty. */
export function missingFields(section: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => {
    const v = section[k];
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'string') return v.trim().length === 0;
    if (v && typeof v === 'object') return Object.keys(v).length === 0;
    return !v;
  });
}

export function useDraft<T extends object>(initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);
  return { draft, setDraft, dirty };
}