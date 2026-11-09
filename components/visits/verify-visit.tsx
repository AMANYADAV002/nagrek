"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, MapPin, QrCode, ScanLine } from "lucide-react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { toast } from "sonner";
import { GradientButton } from "@/components/glass/gradient-button";
import { Spinner } from "@/components/glass/states";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getVisitProgress, issueVisitCode, scanVisitCode, type GpsFix, type ScanResult } from "@/lib/actions/visits";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";

/** A new code every 25 s; the server accepts each one for 45 s and only once. */
const ROTATE_MS = 25_000;

type Gps = { state: "waiting" } | { state: "ok"; fix: GpsFix } | { state: "error"; message: string };

/** Keeps a live, high-accuracy GPS fix while the panel is open. Coordinates go only to our server. */
function useGps(active: boolean): Gps {
  const [gps, setGps] = useState<Gps>({ state: "waiting" });
  useEffect(() => {
    if (!active) return;
    if (!navigator.geolocation) {
      const t = setTimeout(() => setGps({ state: "error", message: "This browser can't share your location." }), 0);
      return () => clearTimeout(t);
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setGps({ state: "ok", fix: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.max(1, p.coords.accuracy), at: Math.round(p.timestamp) } }),
      (e) => setGps({ state: "error", message: e.code === e.PERMISSION_DENIED ? "Allow location access to verify the visit." : "Couldn't get your location. Step outside and try again." }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);
  return gps;
}

/** A fix older than this is refreshed by the browser before we send it. */
function freshFix(gps: Gps): GpsFix | null {
  if (gps.state !== "ok") return null;
  return Date.now() - gps.fix.at < 90_000 ? gps.fix : null;
}

export function VerifyVisitDialog({
  open,
  onOpenChange,
  visitId,
  partnerName,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  partnerName: string;
  onVerified: () => void;
}) {
  const first = partnerName.split(" ")[0];
  const [mode, setMode] = useState<"show" | "scan">("show");
  const [progress, setProgress] = useState({ iScanned: false, partnerScanned: false, verified: false });
  const [result, setResult] = useState<ScanResult | null>(null);
  const gps = useGps(open && !progress.verified);
  const fix = freshFix(gps);

  // Both phones poll, so the one showing its code also learns when the visit is verified.
  useEffect(() => {
    if (!open || progress.verified) return;
    const poll = async () => {
      const p = await getVisitProgress(visitId);
      if (p) setProgress({ iScanned: p.iScanned, partnerScanned: p.partnerScanned, verified: p.status === "verified" });
    };
    void poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [open, progress.verified, visitId]);

  useEffect(() => {
    if (!progress.verified) return;
    fireConfetti({ particleCount: 160, spread: 90 });
    onVerified();
  }, [progress.verified, onVerified]);

  const onScanned = useCallback(
    async (qr: string) => {
      if (!fix) {
        toast.error("Waiting for your location…");
        return false;
      }
      const res = await scanVisitCode(qr, fix);
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      setResult(res);
      setProgress((p) => ({ ...p, iScanned: true, verified: res.state === "verified" }));
      if (res.state !== "verified") {
        toast.success(`Scanned! Now show ${first} your code.`);
        setMode("show");
      }
      return true;
    },
    [fix, first],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-6 sm:max-w-md">
        <div className="space-y-4">
          <div className="space-y-1">
            <DialogTitle className="text-xl">Verify your visit with {first}</DialogTitle>
            <DialogDescription>
              Stand together. Each of you scans the other&apos;s code. We compare both phones&apos; locations on our server and never show them to anyone.
            </DialogDescription>
          </div>

          {progress.verified ? (
            <Verified result={result} first={first} />
          ) : (
            <>
              <ol className="grid grid-cols-2 gap-2 text-xs">
                <Step done={progress.iScanned} label={`You scanned ${first}'s code`} />
                <Step done={progress.partnerScanned} label={`${first} scanned your code`} />
              </ol>

              <p className={cn("flex items-center gap-1.5 text-xs", gps.state === "error" ? "text-red-300" : "text-soft")} role="status">
                <MapPin className="size-3.5" aria-hidden />
                {gps.state === "waiting" && "Getting your location…"}
                {gps.state === "error" && gps.message}
                {gps.state === "ok" && (gps.fix.accuracy <= 100 ? `Location ready (±${Math.round(gps.fix.accuracy)} m)` : `Location too rough (±${Math.round(gps.fix.accuracy)} m). Turn on precise location.`)}
              </p>

              <div role="tablist" aria-label="Verification step" className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
                {(["show", "scan"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm", mode === m ? "bg-brand text-ink" : "text-soft hover:text-cream")}
                  >
                    {m === "show" ? <QrCode className="size-4" /> : <ScanLine className="size-4" />}
                    {m === "show" ? "Show my code" : "Scan their code"}
                  </button>
                ))}
              </div>

              {mode === "show" ? <ShowCode visitId={visitId} fix={fix} /> : <Scanner onScanned={onScanned} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2", done ? "bg-green-500/15 text-green-300" : "bg-white/[0.04] text-soft")}>
      {done ? <CheckCircle2 className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0" />}
      {label}
    </li>
  );
}

function Verified({ result, first }: { result: ScanResult | null; first: string }) {
  return (
    <div className="space-y-3 py-4 text-center">
      <CheckCircle2 className="mx-auto size-12 text-green-400" aria-hidden />
      <p className="text-lg font-medium">Visit verified!</p>
      {result?.counted === false ? (
        <p className="text-sm text-soft">
          {result.reason === "same_partner_this_week"
            ? `You already have a counted visit with ${first} this week, so this one doesn't add to your streak.`
            : "You've reached today's limit of counted visits, so this one doesn't add to your streak."}
        </p>
      ) : (
        <p className="text-sm text-soft">Your visit streak{result?.streak ? ` is now ${result.streak}` : " went up"}.</p>
      )}
      {!!result?.rewards?.length && (
        <p className="text-sm text-peach">You unlocked {result.rewards.length} sponsor reward{result.rewards.length === 1 ? "" : "s"}. See your codes on the Streak page.</p>
      )}
    </div>
  );
}

/** Rotating, single-use QR code tied to this phone's current location. */
function ShowCode({ visitId, fix }: { visitId: string; fix: GpsFix | null }) {
  const [img, setImg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fixRef = useRef(fix);
  useEffect(() => {
    fixRef.current = fix;
  });
  const hasFix = !!fix;

  useEffect(() => {
    if (!hasFix) return;
    let stopped = false;
    const refresh = async () => {
      if (!fixRef.current) return;
      const res = await issueVisitCode(visitId, fixRef.current);
      if (stopped) return;
      if (!res.ok) {
        setImg(null);
        setError(res.error);
        return;
      }
      setError(null);
      setImg(await QRCode.toDataURL(res.qr, { margin: 1, width: 320, errorCorrectionLevel: "M" }));
    };
    void refresh();
    const t = setInterval(refresh, ROTATE_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [hasFix, visitId]);

  if (error) return <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300">{error}</p>;
  if (!img) return <div className="grid h-72 place-items-center"><Spinner /></div>;
  return (
    <div className="space-y-2 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
      <img src={img} alt="Your visit code" className="mx-auto w-64 rounded-2xl bg-white p-2" />
      <p className="text-xs text-soft">The code changes every 25 seconds and works once. Screenshots stop working quickly.</p>
    </div>
  );
}

/** Rear camera QR scanner (jsQR works in every browser, including iPhone Safari). */
function Scanner({ onScanned }: { onScanned: (qr: string) => Promise<boolean> }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const onScannedRef = useRef(onScanned);
  useEffect(() => {
    onScannedRef.current = onScanned;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let paused = false;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (stopped) return;
      const v = video.current;
      if (!paused && v && ctx && v.readyState >= 2 && v.videoWidth) {
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
        if (code?.data.startsWith("nagrek-visit:")) {
          paused = true;
          setChecking(true);
          const ok = await onScannedRef.current(code.data);
          setChecking(false);
          if (!ok) setTimeout(() => (paused = false), 2000);
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
        raf = requestAnimationFrame(() => void tick());
      } catch {
        setError("Allow camera access to scan the code.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) return <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
      <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-peach/80" aria-hidden />
      {checking && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <Spinner />
        </div>
      )}
      <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">Point at their code</p>
    </div>
  );
}

export function VerifyButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <GradientButton size="sm" onClick={onClick} disabled={disabled}>
      <ScanLine /> Verify meetup
    </GradientButton>
  );
}
