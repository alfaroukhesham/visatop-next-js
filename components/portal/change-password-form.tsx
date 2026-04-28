"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { apiHref } from "@/lib/app-href";

type Ok = { ok: true; data: { changed: boolean } };
type Err = { ok: false; error?: { message?: string } };

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(apiHref("/portal/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const json = (await res.json().catch(() => null)) as Ok | Err | null;
      if (!res.ok || !json?.ok) {
        setMsg(
          json && "ok" in json && json.ok === false
            ? (json.error?.message ?? "Unable to change password.")
            : "Unable to change password.",
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setMsg("Password updated.");
    } catch {
      setMsg("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold tracking-tight">Change password</p>
        <p className="text-muted-foreground text-xs">
          Use a unique password with at least 8 characters.
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <ClientField id="current-password" label="Current password">
          <ClientInput
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="rounded-[5px] border-border"
          />
        </ClientField>
        <ClientField id="new-password" label="New password">
          <ClientInput
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="rounded-[5px] border-border"
          />
        </ClientField>

        {msg ? <p className="text-muted-foreground text-sm">{msg}</p> : null}

        <ClientButton type="submit" brand="cta" disabled={busy} className="font-semibold">
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </ClientButton>
      </form>
    </section>
  );
}

