"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Gift, MapPin, Music2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Chip } from "@/components/glass/chip";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { EmptyState } from "@/components/glass/states";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { AmbientSynth } from "@/lib/audio/synth";
import { PlaceMap } from "@/components/explore/place-map";
import { cities as cityCenters } from "@/lib/data/cities";
import { cravingEmoji } from "@/lib/data/cravings";
import type { MapPoint, MapView } from "@/lib/map/overlay";
import { uid } from "@/lib/format";
import { addWish } from "@/lib/actions/account";
import { backendEnabled } from "@/lib/supabase/env";
import { places } from "@/lib/mock/places";
import { useDraft } from "@/lib/draft";
import { updateSession, useSession } from "@/lib/mock/session";

/** Curated seed list. TODO(phase-6): `places` table; Google Places integration later. */
export function ExploreView() {
  const session = useSession();
  const myCity = session?.preferences?.location.city;
  const [city, setCity] = useDraft("explore-city", "all");
  const [cuisine, setCuisine] = useDraft("explore-cuisine", "all");
  const [applied, setApplied] = useState({ city: "all", cuisine: "all" });
  const [ambient, setAmbient] = useState(false);
  const synth = useRef<AmbientSynth | null>(null);

  useEffect(() => () => synth.current?.close(), []);

  // Chips update immediately. The list follows a moment later so a fast tap doesn't rebuild it twice.
  useEffect(() => {
    const t = setTimeout(() => setApplied({ city, cuisine }), 200);
    return () => clearTimeout(t);
  }, [city, cuisine]);

  async function toggleAmbient() {
    if (ambient) {
      synth.current?.stop();
      setAmbient(false);
      return;
    }
    if (!synth.current) {
      const { AmbientSynth } = await import("@/lib/audio/synth");
      synth.current = new AmbientSynth();
      synth.current.setVolume(0.35);
    }
    await synth.current.start("piano");
    setAmbient(true);
  }

  const cities = [...new Set(places.map((p) => p.city))];
  const cuisines = [...new Set(places.map((p) => p.cuisine))];
  const effectiveCity = city === "all" && myCity && cities.includes(myCity) ? myCity : city;
  const listCity = applied.city === "all" && myCity && cities.includes(myCity) ? myCity : applied.city;
  const list = useMemo(
    () => places.filter((p) => (listCity === "all" || p.city === listCity) && (applied.cuisine === "all" || p.cuisine === applied.cuisine)),
    [listCity, applied.cuisine],
  );
  const mapView = useMemo<MapView>(() => {
    if (effectiveCity !== "all") {
      const city = cityCenters.find((item) => item.name === effectiveCity);
      if (city) return { lng: city.point.lng, lat: city.point.lat, zoom: 11 };
    }
    return { lng: 79.5, lat: 22.5, zoom: 4 };
  }, [effectiveCity]);
  const mapPins = useMemo<MapPoint[]>(() => {
    const names = new Set(list.map((place) => place.city));
    return cityCenters.flatMap((city) =>
      names.has(city.name) ? [{ id: city.name, name: city.name, lat: city.point.lat, lng: city.point.lng, kind: "city" as const }] : [],
    );
  }, [list]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Discover"
        title={<>Explore <span className="text-brand">places</span></>}
        description="Restaurants and cafes worth sharing. Sponsored spots are tied to streak rewards."
        action={
          <GradientButton size="sm" variant={ambient ? "brand" : "glass"} onClick={toggleAmbient} aria-pressed={ambient}>
            <Music2 /> {ambient ? "Piano on" : "Ambient piano"}
          </GradientButton>
        }
      />

      <div className="space-y-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip selected={effectiveCity === "all"} onClick={() => setCity("all")} showCheck={false}>All cities</Chip>
          {cities.map((c) => (
            <Chip key={c} selected={effectiveCity === c} onClick={() => setCity(c)} showCheck={false}>
              <MapPin className="size-3.5" aria-hidden /> {c}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip selected={cuisine === "all"} onClick={() => setCuisine("all")} showCheck={false}>All food</Chip>
          {cuisines.map((c) => (
            <Chip key={c} selected={cuisine === c} onClick={() => setCuisine(c)} showCheck={false}>
              {cravingEmoji[c] ?? "🍽️"} {c}
            </Chip>
          ))}
        </div>
      </div>

      <PlaceMap view={mapView} points={mapPins} />
      <p className="text-xs text-soft">Pins mark city centres from Nagrek’s city list. The cards below are the curated places.</p>

      {list.length === 0 ? (
        <EmptyState icon={<MapPin className="size-8" />} title="No places match" description="Try another city or cuisine." />
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" key={`${effectiveCity}-${cuisine}`}>
          {list.map((p) => (
            <StaggerItem key={p.id}>
              <GlassCard className="flex h-full flex-col gap-4 p-5 transition-transform hover:-translate-y-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-14 place-items-center rounded-2xl bg-white/[0.06] text-3xl" aria-hidden>
                    {cravingEmoji[p.cuisine] ?? "🍽️"}
                  </span>
                  {p.sponsored && (
                    <span className="flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-ink">
                      <BadgeCheck className="size-3" aria-hidden /> Sponsor
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-medium">{p.name}</h2>
                  <p className="text-sm text-soft">
                    {p.cuisine} · {p.area}, {p.city} · {"₹".repeat(p.priceLevel)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="size-3.5 fill-peach text-peach" aria-hidden /> {p.rating}
                  </p>
                  {p.rewardHint && (
                    <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-peach/10 px-3 py-2 text-xs text-peach">
                      <Gift className="size-3.5" aria-hidden /> {p.rewardHint}
                    </p>
                  )}
                </div>
                <GradientButton
                  size="sm"
                  variant="glass"
                  onClick={() => {
                    const localId = uid("w");
                    const note = `${p.cuisine} in ${p.area}`;
                    updateSession((s) => ({
                      wishlist: [{ id: localId, kind: "place", title: p.name, note, sharedWith: [], createdAt: new Date().toISOString() }, ...s.wishlist],
                    }));
                    toast.success(`${p.name} added to your wish list`);
                    if (!backendEnabled()) return;
                    void addWish({ kind: "place", title: p.name, note }).then((saved) => {
                      if (!saved.ok) return toast.error(saved.error ?? "Could not save");
                      if (saved.id) updateSession((s) => ({ wishlist: s.wishlist.map((w) => (w.id === localId ? { ...w, id: saved.id! } : w)) }));
                    });
                  }}
                >
                  <Plus /> Add to wish list
                </GradientButton>
              </GlassCard>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
