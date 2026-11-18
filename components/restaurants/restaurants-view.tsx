"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Search, Star, Store, Utensils } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass/glass-card";
import { GradientButton } from "@/components/glass/gradient-button";
import { PageHeader } from "@/components/glass/section-heading";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { proposeVisit } from "@/lib/actions/visits";
import type { PlaceSuggestion, Restaurant } from "@/lib/places/google";
import { DIET_FILTERS, PLACE_CRAVINGS, matchedCravings, searchCacheKey, type DietId } from "@/lib/places/query";
import { roundCoord } from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";

const CACHE_MS = 10 * 60_000;
const clientCache = new Map<string, { at: number; restaurants: Restaurant[]; summary: string }>();

interface Filters {
  cravings: string[];
  diets: DietId[];
  maxPrice: number;
  minRating: number;
  openNow: boolean;
}

interface Near {
  mode: "near";
  lat: number;
  lng: number;
  label: string;
}

interface Area {
  mode: "area";
  label: string;
}

type LocationChoice = Near | Area;

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function requestKey(loc: LocationChoice, filters: Filters) {
  const point = loc.mode === "near" ? { lat: loc.lat, lng: loc.lng } : { lat: Number.NaN, lng: Number.NaN };
  const area = loc.mode === "area" ? loc.label : "";
  return `${loc.mode}:${area}${searchCacheKey({ ...filters, ...point, area })}`;
}

function searchParams(loc: LocationChoice, filters: Filters) {
  const params = new URLSearchParams({ mode: "search" });
  if (loc.mode === "near") {
    params.set("lat", String(loc.lat));
    params.set("lng", String(loc.lng));
  } else {
    params.set("area", loc.label);
  }
  if (filters.cravings.length) params.set("cravings", filters.cravings.join(","));
  if (filters.diets.length) params.set("diets", filters.diets.join(","));
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters.minRating) params.set("minRating", String(filters.minRating));
  if (filters.openNow) params.set("open", "1");
  return params;
}

/** Restaurant discovery for one match. Filters debounce in the click handler so the chip paints immediately. */
export function RestaurantsView({ withId, partnerName, food }: { withId: string; partnerName: string; food: string }) {
  const router = useRouter();
  const matched = matchedCravings(food);
  const partnerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(withId) ? withId : "";
  const [filters, setFilters] = useState<Filters>({ cravings: matched, diets: [], maxPrice: 0, minRating: 0, openNow: false });
  const [query, setQuery] = useState(filters);
  const [loc, setLoc] = useState<LocationChoice | null>(null);
  const [locError, setLocError] = useState("");
  const [area, setArea] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [result, setResult] = useState<{ key: string; restaurants: Restaurant[]; error: string; summary: string } | null>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 24 * 3_600_000)));
  const [saving, setSaving] = useState(false);
  const filterTimer = useRef<number | null>(null);
  const suggestTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ mode: "near", lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude), label: "Near you" });
        setLocError("");
      },
      () => setLocError("Location is off. Search a neighborhood instead."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!loc) return;
    const key = requestKey(loc, query);
    const cached = clientCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      queueMicrotask(() => setResult({ key, restaurants: cached.restaurants, error: "", summary: cached.summary }));
      return;
    }
    let cancelled = false;
    void fetch(`/api/places?${searchParams(loc, query).toString()}`)
      .then(async (res) => ({ ok: res.ok, body: (await res.json()) as { restaurants?: Restaurant[]; error?: string; summary?: string } }))
      .then(({ body }) => {
        if (cancelled) return;
        const restaurants = body.restaurants ?? [];
        const error = body.error ?? "";
        const summary = body.summary ?? "";
        if (!error) clientCache.set(key, { at: Date.now(), restaurants, summary });
        setResult({ key, restaurants, error, summary });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, restaurants: [], error: "Could not load restaurants.", summary: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [loc, query]);

  function applyFilters(next: Filters) {
    setFilters(next);
    if (filterTimer.current) window.clearTimeout(filterTimer.current);
    filterTimer.current = window.setTimeout(() => setQuery(next), 300);
  }

  function toggleCraving(craving: string) {
    const cravings = filters.cravings.includes(craving) ? filters.cravings.filter((item) => item !== craving) : [...filters.cravings, craving];
    applyFilters({ ...filters, cravings });
  }

  function toggleDiet(diet: DietId) {
    const diets = filters.diets.includes(diet) ? filters.diets.filter((item) => item !== diet) : [...filters.diets, diet];
    applyFilters({ ...filters, diets });
  }

  function chooseArea(value: string) {
    const q = value.trim().slice(0, 80);
    if (q.length < 2) return;
    setLoc({ mode: "area", label: q });
    setLocError("");
  }

  function onArea(value: string) {
    setArea(value);
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    suggestTimer.current = window.setTimeout(() => {
      const q = value.trim();
      if (q.length < 2) return setSuggestions([]);
      const params = new URLSearchParams({ mode: "suggest", q });
      if (loc?.mode === "near") {
        params.set("lat", String(loc.lat));
        params.set("lng", String(loc.lng));
      }
      void fetch(`/api/places?${params.toString()}`)
        .then((res) => res.json())
        .then((body: { suggestions?: PlaceSuggestion[]; error?: string }) => {
          setSuggestions(body.suggestions ?? []);
          if (body.error) setLocError(body.error);
        })
        .catch(() => setSuggestions([]));
    }, 300);
  }

  const key = loc ? requestKey(loc, query) : "";
  const ready = result?.key === key ? result : null;
  const restaurants = ready?.restaurants ?? [];
  const error = ready?.error ?? "";
  const summary = ready?.summary ?? "";
  const loading = !!loc && !ready;

  async function propose(restaurant: Restaurant) {
    if (!partnerId) return;
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) return toast.error("Pick a time.");
    const link = [restaurant.mapsUrl, restaurant.website].filter(Boolean).join("\n");
    setSaving(true);
    const res = await proposeVisit({
      inviteeId: partnerId,
      placeName: restaurant.name.slice(0, 120),
      placeArea: restaurant.address.slice(0, 120) || undefined,
      note: link.length <= 300 ? link : undefined,
      scheduledAt: at.toISOString(),
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${partnerName || "Your match"} can confirm ${restaurant.name}.`);
    router.push("/visits");
  }

  return (
    <div className="space-y-6">
      <Link href={partnerId ? `/history/${partnerId}` : "/visits"} className="inline-flex items-center gap-2 text-sm text-soft">
        <ArrowLeft className="size-4" /> {partnerId ? `Back to ${partnerName || "the plan"}` : "Back to visits"}
      </Link>
      <PageHeader
        eyebrow="Meetup planner"
        title={<>Pick a <span className="text-brand">restaurant</span></>}
        description={partnerName ? `Choose a spot for you and ${partnerName}. They get a request to confirm it.` : "Find a restaurant, then propose it from a match."}
      />

      <GlassCard className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={loc?.mode === "near"}
            onClick={() => {
              if (!navigator.geolocation) return setLocError("This browser has no location.");
              navigator.geolocation.getCurrentPosition(
                (pos) => setLoc({ mode: "near", lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude), label: "Near you" }),
                () => setLocError("Location is off. Search a neighborhood instead."),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
              );
            }}
            className={cn("rounded-full px-3 py-1.5 text-sm", loc?.mode === "near" ? "bg-brand text-ink" : "bg-white/10")}
          >
            Near me
          </button>
          <span className="text-sm text-soft">{loc ? loc.label : "Waiting for a location"}</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-soft" aria-hidden />
          <Input
            aria-label="Search a neighborhood or city"
            placeholder="Neighborhood, landmark, or city"
            value={area}
            onChange={(e) => onArea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") chooseArea(area);
            }}
            className="h-11 rounded-xl pl-9"
          />
          {suggestions.length > 0 && (
            <ul className="glass-strong absolute z-10 mt-2 w-full overflow-hidden rounded-2xl" role="listbox">
              {suggestions.map((item) => (
                <li key={item.placeId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={area === item.label}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10"
                    onClick={() => {
                      setArea(item.label);
                      setSuggestions([]);
                      chooseArea(item.label);
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {locError && <p className="text-sm text-soft">{locError}</p>}

        <div className="flex flex-wrap gap-2" aria-label="Cravings">
          {PLACE_CRAVINGS.map((craving) => {
            const on = filters.cravings.includes(craving);
            const fromMatch = matched.includes(craving);
            return (
              <button
                key={craving}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCraving(craving)}
                className={cn("rounded-full px-3 py-1.5 text-sm", on ? "bg-brand text-ink" : "bg-white/10")}
              >
                {craving}
                {fromMatch && <span className="ml-1 text-[10px] tracking-wide uppercase">{on ? "Matched craving" : "Match"}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Dietary preferences">
          {DIET_FILTERS.map((diet) => (
            <button
              key={diet.id}
              type="button"
              aria-pressed={filters.diets.includes(diet.id)}
              onClick={() => toggleDiet(diet.id)}
              className={cn("rounded-full px-3 py-1.5 text-sm", filters.diets.includes(diet.id) ? "bg-brand text-ink" : "bg-white/10")}
            >
              {diet.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-soft">
            Price
            <select
              aria-label="Price range"
              value={filters.maxPrice}
              onChange={(e) => applyFilters({ ...filters, maxPrice: Number(e.target.value) })}
              className="ml-2 h-9 rounded-full border border-white/10 bg-transparent px-3"
            >
              <option value={0} className="bg-ink">Any</option>
              <option value={1} className="bg-ink">₹</option>
              <option value={2} className="bg-ink">Up to ₹₹</option>
              <option value={3} className="bg-ink">Up to ₹₹₹</option>
              <option value={4} className="bg-ink">Up to ₹₹₹₹</option>
            </select>
          </label>
          <label className="text-soft">
            Rating
            <select
              aria-label="Minimum rating"
              value={filters.minRating}
              onChange={(e) => applyFilters({ ...filters, minRating: Number(e.target.value) })}
              className="ml-2 h-9 rounded-full border border-white/10 bg-transparent px-3"
            >
              <option value={0} className="bg-ink">Any</option>
              <option value={4} className="bg-ink">4.0+</option>
              <option value={4.5} className="bg-ink">4.5+</option>
            </select>
          </label>
          <button
            type="button"
            aria-pressed={filters.openNow}
            onClick={() => applyFilters({ ...filters, openNow: !filters.openNow })}
            className={cn("rounded-full px-3 py-1.5", filters.openNow ? "bg-brand text-ink" : "bg-white/10")}
          >
            Open now
          </button>
        </div>
      </GlassCard>

      {!loc && <p className="text-sm text-soft">Allow location, or type a neighborhood such as Indiranagar.</p>}
      {loading && <p className="text-sm text-soft">Looking up restaurants…</p>}
      {summary && <p className="text-sm text-soft">{summary}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {loc && !loading && !error && restaurants.length === 0 && (
        <p className="text-sm text-soft">No restaurants matched those filters. Try another craving or a wider area.</p>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {restaurants.map((restaurant) => (
          <li key={restaurant.id}>
            <button type="button" onClick={() => setSelected(restaurant)} className="w-full text-left">
              <GlassCard className="flex h-full gap-3 p-3">
                <RestaurantPhoto name={restaurant.photoName} title={restaurant.name} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate font-semibold">{restaurant.name}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-soft">
                    {restaurant.rating !== null && (
                      <span className="inline-flex items-center gap-1"><Star className="size-3 text-peach" aria-hidden /> {restaurant.rating.toFixed(1)} ({restaurant.reviewCount ?? 0})</span>
                    )}
                    {restaurant.priceLabel && <span>{restaurant.priceLabel}</span>}
                    {restaurant.openNow !== null && <span>{restaurant.openNow ? "Open" : "Closed"}</span>}
                  </span>
                  {restaurant.cuisine && <span className="block text-xs text-soft">{restaurant.cuisine}</span>}
                  <span className="flex flex-wrap gap-1">
                    {restaurant.badges.map((badge) => (
                      <span key={badge} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{badge}</span>
                    ))}
                  </span>
                  {restaurant.address && (
                    <span className="flex items-start gap-1 text-xs text-soft"><MapPin className="mt-0.5 size-3 shrink-0" aria-hidden /> {restaurant.address}</span>
                  )}
                </span>
              </GlassCard>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="glass-strong max-w-md rounded-3xl border-0 p-6 sm:max-w-md">
          {selected && (
            <div className="space-y-4">
              <RestaurantPhoto name={selected.photoName} title={selected.name} wide />
              <div className="space-y-1">
                <DialogTitle className="text-xl">{selected.name}</DialogTitle>
                <DialogDescription>
                  {selected.rating !== null ? `${selected.rating.toFixed(1)} · ${selected.reviewCount ?? 0} reviews` : "Restaurant"}
                  {selected.priceLabel ? ` · ${selected.priceLabel}` : ""}
                  {selected.openNow !== null ? ` · ${selected.openNow ? "Open" : "Closed"}` : ""}
                </DialogDescription>
                {selected.address && <p className="text-sm text-soft">{selected.address}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={selected.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm">
                  <MapPin className="size-4" aria-hidden /> View on Google Maps
                </a>
                {selected.website && (
                  <a href={selected.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm">
                    <ExternalLink className="size-4" aria-hidden /> Visit Website / Menu
                  </a>
                )}
              </div>
              {partnerId ? (
                <div className="space-y-3">
                  <Input aria-label="Meetup time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11 rounded-xl [color-scheme:dark]" />
                  <GradientButton className="w-full" disabled={saving} onClick={() => void propose(selected)}>
                    <Store className="size-4" /> {saving ? "Sending…" : "Propose this restaurant"}
                  </GradientButton>
                </div>
              ) : (
                <p className="text-sm text-soft">Open restaurants from a match to propose this spot.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RestaurantPhoto({ name, title, wide }: { name: string | null; title: string; wide?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!name || failed) {
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-2xl bg-white/5 text-soft", wide ? "h-40 w-full" : "size-24")}>
        <Utensils className="size-6" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/places/photo?name=${encodeURIComponent(name)}`}
      alt={title}
      className={cn("shrink-0 rounded-2xl object-cover", wide ? "h-40 w-full" : "size-24")}
      onError={() => setFailed(true)}
    />
  );
}
