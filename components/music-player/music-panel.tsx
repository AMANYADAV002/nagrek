"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Music2, Pause, Play, Share2, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { AmbientSynth } from "@/lib/audio/synth";
import { tracks, type Track } from "@/lib/config/tracks";
import { cn } from "@/lib/utils";

/**
 * In-call music panel. Premium/Ultra only; Plus sees a locked state.
 * Plays locally by default. TODO(phase-5): "share with partner" mixes the
 * synth/audio output into the outgoing WebRTC audio track.
 */
export function MusicPanel({ unlocked, onClose }: { unlocked: boolean; onClose: () => void }) {
  const synth = useRef<AmbientSynth | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [share, setShare] = useState(false);

  useEffect(() => {
    return () => {
      synth.current?.close();
      audio.current?.pause();
    };
  }, []);

  async function play(track: Track) {
    setCurrent(track);
    setPlaying(true);
    if (track.src) {
      synth.current?.stop();
      audio.current ??= new Audio();
      audio.current.src = track.src;
      audio.current.loop = true;
      audio.current.volume = volume / 100;
      await audio.current.play().catch(() => toast.error("Could not play that track."));
      return;
    }
    audio.current?.pause();
    if (!synth.current) {
      const { AmbientSynth } = await import("@/lib/audio/synth");
      synth.current = new AmbientSynth();
      synth.current.setVolume(volume / 100);
    }
    await synth.current.start(track.preset);
  }

  function pause() {
    setPlaying(false);
    synth.current?.stop();
    audio.current?.pause();
  }

  function changeVolume(v: number) {
    setVolume(v);
    synth.current?.setVolume(v / 100);
    if (audio.current) audio.current.volume = v / 100;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass-strong w-[min(92vw,22rem)] space-y-4 rounded-3xl p-5"
      role="dialog"
      aria-label="Music"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <Music2 className="size-4 text-peach" aria-hidden /> Table music
        </p>
        <button type="button" onClick={onClose} aria-label="Close music" className="grid size-8 place-items-center rounded-full hover:bg-white/10">
          <X className="size-4" />
        </button>
      </div>

      {!unlocked ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
          <Lock className="mx-auto size-6 text-peach" aria-hidden />
          <p className="text-sm">Piano, violin and cafe ambience are part of Premium and Ultra.</p>
          <Link href="/plans" className="inline-flex rounded-full bg-brand px-4 py-2 text-xs font-bold text-ink">Upgrade</Link>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {tracks.map((t) => {
              const active = current?.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => (active && playing ? pause() : play(t))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                      active ? "bg-peach/15 ring-1 ring-peach/40" : "hover:bg-white/5",
                    )}
                    aria-pressed={active && playing}
                  >
                    <span className={cn("grid size-9 place-items-center rounded-full", active ? "bg-brand text-ink" : "bg-white/10")}>
                      {active && playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{t.title}</span>
                      <span className="block text-[11px] text-soft">{t.mood}</span>
                    </span>
                    {active && playing && (
                      <span className="flex h-4 items-end gap-0.5" aria-hidden>
                        {[0, 1, 2].map((b) => (
                          <motion.span
                            key={b}
                            className="w-1 rounded-full bg-peach"
                            animate={{ height: ["30%", "100%", "45%"] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: b * 0.15 }}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-3">
            <Volume2 className="size-4 shrink-0 text-soft" aria-hidden />
            <Slider aria-label="Music volume" min={0} max={100} value={[volume]} onValueChange={(v) => changeVolume(Array.isArray(v) ? v[0] : v)} />
          </div>
          <label className="flex items-center justify-between gap-3 text-xs text-soft">
            <span className="flex items-center gap-2">
              <Share2 className="size-3.5" aria-hidden /> Share music with partner
            </span>
            <Switch
              checked={share}
              onCheckedChange={(c) => {
                setShare(c);
                if (c) toast.info("Sharing music into the call arrives with real WebRTC in Phase 5. Playing locally for now.");
              }}
            />
          </label>
        </>
      )}
    </motion.div>
  );
}
