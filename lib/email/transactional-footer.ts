const DEFAULT_FOOTER = `—
Visatop
This is an automated message regarding your visa application.`;

export function getTransactionalEmailFooter(): string {
  const raw = 'Copyright © 2026 Visatop. All rights reserved.';
  return raw && raw.length > 0 ? raw : DEFAULT_FOOTER;
}

export function withTransactionalFooter(body: string): string {
  const b = body.trimEnd();
  const f = getTransactionalEmailFooter().trim();
  return `${b}\n\n${f}`;
}

export function transactionalSubjectPrefix(): string {
  if (process.env.NODE_ENV === "production") return "";
  const env = process.env.VERCEL_ENV;
  if (env === "preview") return "[Preview] ";
  if (env === "development" || process.env.NODE_ENV === "development") return "[Dev] ";
  return "[Non-prod] ";
}
