/**
 * Mailgun HTTP API (EU). Plain multipart messages; no provider IDs leak to clients.
 */

const EU_BASE = "https://api.eu.mailgun.net";

export type MailgunSendTextInput = {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; contentType: string; bytes: Buffer }[];
};

export function isMailgunConfigured(): boolean {
  const key = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  return Boolean(key && domain);
}

export async function mailgunSendText(input: MailgunSendTextInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  const from = process.env.MAILGUN_FROM?.trim() ?? "Visatop <info@visatop.com>";

  if (!key || !domain) {
    return { ok: false, error: "MAILGUN_API_KEY or MAILGUN_DOMAIN not configured" };
  }

  const base = process.env.MAILGUN_API_BASE_URL?.trim() || EU_BASE;
  const url = `${base.replace(/\/$/, "")}/v3/${encodeURIComponent(domain)}/messages`;

  const form = new FormData();
  form.set("from", from);
  form.set("to", input.to);
  form.set("subject", input.subject);
  form.set("text", input.text);

  for (const a of input.attachments ?? []) {
    const blob = new Blob([new Uint8Array(a.bytes)], { type: a.contentType || "application/octet-stream" });
    form.append("attachment", blob, a.filename);
  }

  const auth = Buffer.from(`api:${key}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, error: `Mailgun HTTP ${res.status}: ${errText.slice(0, 500)}` };
  }

  return { ok: true };
}
