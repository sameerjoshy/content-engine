import type { Env } from '../env';

/**
 * Send email via Resend API. Used for the newsletter (Substack) edition
 * distribution. Returns { ok, error? } — never throws.
 */
export async function sendEmail(
  env: Env,
  opts: { to: string[]; subject: string; html: string; text?: string; from?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY not configured' };
  const from = opts.from ?? `Content Engine <content@gtm-360.com>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text ?? opts.html.replace(/<[^>]+>/g, '').slice(0, 5000),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Email send failed' };
  }
}

/** Convert a markdown newsletter edition to minimal HTML for email. */
export function markdownToEmailHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      out.push('<p style="margin:14px 0"></p>');
      continue;
    }
    if (line.startsWith('# ')) {
      out.push(`<h1 style="font-size:22px;line-height:1.3;margin:20px 0 8px">${esc(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      out.push(`<h2 style="font-size:18px;margin:20px 0 8px">${esc(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      out.push(`<h3 style="font-size:16px;margin:16px 0 6px">${esc(line.slice(4))}</h3>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      out.push(`<li style="margin:4px 0 4px 16px">${esc(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
    } else if (/^\s*\d+\.\s+/.test(line)) {
      out.push(`<li style="margin:4px 0 4px 16px">${esc(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
    } else if (/^\s*---/.test(line)) {
      out.push('<hr style="margin:20px 0;border:0;border-top:1px solid #e5e7eb" />');
    } else if (/^\[.*\]\(.*\)/.test(line) || /https?:\/\//.test(line)) {
      out.push(
        `<p style="font-size:15px;line-height:1.6;margin:10px 0">${esc(line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')).replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1" style="color:#2563eb">$1</a>',
        )}</p>`,
      );
    } else {
      out.push(`<p style="font-size:15px;line-height:1.6;margin:10px 0">${esc(line)}</p>`);
    }
  }
  return out.join('\n');
}