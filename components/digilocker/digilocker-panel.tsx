"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton, GradientLink } from "@/components/glass/gradient-button";
import { Eyebrow } from "@/components/glass/section-heading";

type Status = {
  mode: "mock" | "official" | "off";
  connected: boolean;
  expired?: boolean;
  name?: string;
  digilockerId?: string;
  adult?: boolean | null;
};

type DocumentRow = {
  uri: string;
  name: string;
  description: string;
  issuer: string;
  mime: string[];
  downloadable: boolean;
  simulated: boolean;
};

const ERRORS: Record<string, string> = {
  denied: "DigiLocker did not grant access.",
  invalid_code: "The authorization code was rejected.",
  invalid_state: "The sign-in attempt did not match this browser.",
  unauthorized: "Sign in before connecting DigiLocker.",
  unconfigured: "DigiLocker credentials are not configured.",
  backend: "DigiLocker did not respond.",
};

export function DigiLockerPanel() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryError = params.get("error");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/digilocker/status")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as Status;
        setStatus(json);
        if (!json.connected) return;
        const list = await fetch("/api/digilocker/documents");
        const body = (await list.json()) as { documents?: DocumentRow[]; error?: string };
        if (cancelled) return;
        if (!list.ok) setMessage(body.error ?? "Documents could not be loaded.");
        else setDocuments(body.documents ?? []);
      })
      .catch(() => {
        if (!cancelled) setMessage("DigiLocker could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/digilocker/disconnect", { method: "POST" });
      if (!res.ok) {
        setMessage("DigiLocker could not be disconnected.");
        return;
      }
      setStatus((current) => (current ? { ...current, connected: false } : current));
      setDocuments(null);
      setPreview(null);
    } catch {
      setMessage("DigiLocker could not be disconnected.");
    } finally {
      setBusy(false);
    }
  }

  async function showXml(uri: string) {
    setBusy(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/digilocker/documents/file?format=xml&uri=${encodeURIComponent(uri)}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setMessage(body.error ?? "That document could not be opened.");
        return;
      }
      setPreview(await res.text());
    } catch {
      setMessage("That document could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  const notice = queryError ? ERRORS[queryError] ?? "DigiLocker could not be connected." : message;

  return (
    <GlassCard className="mx-auto max-w-2xl p-6 md:p-8">
      <Eyebrow>Documents</Eyebrow>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-medium">
        <ShieldCheck className="size-7 text-peach" aria-hidden /> DigiLocker
      </h1>
      <p className="mt-2 text-sm text-soft">Connect your locker to list documents and download a copy into this browser. Nagrek does not save the file.</p>
      {status?.mode === "mock" && (
        <p className="mt-4 rounded-2xl border border-peach/40 bg-peach/10 px-4 py-3 text-sm">Demo mode. These documents are simulated and were not issued by a government.</p>
      )}
      {status?.mode === "off" && <p className="mt-4 text-sm">DigiLocker is not enabled on this server.</p>}
      {status?.expired && <p className="mt-4 text-sm">The DigiLocker session expired. Connect again.</p>}
      {notice && <p className="mt-4 text-sm" role="alert">{notice}</p>}

      {status && !status.connected && status.mode !== "off" && (
        <GradientLink className="mt-6" href="/api/digilocker/connect" size="lg">Connect DigiLocker</GradientLink>
      )}

      {status?.connected && (
        <div className="mt-6 space-y-4">
          <p className="text-sm">
            Connected as <span className="font-semibold">{status.name}</span>
            {status.digilockerId ? <span className="text-soft"> · {status.digilockerId}</span> : null}
            {status.adult === false ? <span className="text-soft"> · Under 18</span> : null}
          </p>
          {documents?.length === 0 && <p className="text-sm text-soft">No documents were shared.</p>}
          <ul className="space-y-3">
            {documents?.map((document) => (
              <li key={document.uri} className="rounded-2xl border border-white/10 p-4">
                <p className="font-medium">{document.name}</p>
                <p className="text-xs text-soft">{document.issuer} {document.description}</p>
                {document.simulated && <p className="mt-1 text-xs text-peach">Simulated sample</p>}
                {document.downloadable ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a className="text-sm text-peach underline" href={`/api/digilocker/documents/file?format=pdf&uri=${encodeURIComponent(document.uri)}`}>Download</a>
                    <button type="button" className="text-sm text-peach underline" disabled={busy} onClick={() => void showXml(document.uri)}>Preview XML</button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs">Aadhaar files are not downloaded.</p>
                )}
              </li>
            ))}
          </ul>
          {preview && <pre className="overflow-auto rounded-2xl bg-black/30 p-4 text-xs">{preview}</pre>}
          <GradientButton variant="outline" disabled={busy} onClick={() => void disconnect()}>Disconnect DigiLocker</GradientButton>
        </div>
      )}
    </GlassCard>
  );
}
