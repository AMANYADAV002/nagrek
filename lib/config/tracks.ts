/**
 * Music library for calls. Phase 1 has no audio files: each track falls back
 * to a Web Audio synth preset (see lib/audio/synth.ts), so nothing needs a
 * licence yet. When real files are added to /public/audio, set `src` and they
 * take precedence. LICENSING: only royalty-free or properly licensed tracks may
 * be added — see DECISIONS.md.
 */
export type SynthPreset = "piano" | "violin" | "soft" | "cafe";

export interface Track {
  id: string;
  title: string;
  mood: string;
  preset: SynthPreset;
  src?: string;
}

export const tracks: Track[] = [
  { id: "moonlit-keys", title: "Moonlit Keys", mood: "Piano", preset: "piano" },
  { id: "velvet-strings", title: "Velvet Strings", mood: "Violin", preset: "violin" },
  { id: "slow-sunday", title: "Slow Sunday", mood: "Soft instrumental", preset: "soft" },
  { id: "corner-cafe", title: "Corner Cafe", mood: "Cafe ambience", preset: "cafe" },
];
