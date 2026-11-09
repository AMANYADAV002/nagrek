import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Plus, Radar, ShieldCheck, Utensils, Video } from "lucide-react";
import { GradientLink } from "@/components/glass/gradient-button";
import { cravings, marqueePairs } from "@/lib/data/cravings";
import { faqs } from "@/lib/data/faq";
import { formatInr, plans } from "@/lib/config/plans";
import { freePreview } from "@/lib/payments/mode";
import { cn } from "@/lib/utils";

function Kicker({ left, right }: { left: string; right: string }) {
  return (
    <div className="mb-8 flex justify-between text-[9px] tracking-[0.18em] text-soft uppercase">
      <span className="text-peach">{left}</span>
      <span>{right}</span>
    </div>
  );
}

export function CravingGrid() {
  return (
    <section id="cravings" className="mx-auto max-w-[1440px] scroll-mt-20 px-[6%] py-16 md:py-20" data-reveal>
      <Kicker left="01 / What are you craving?" right="Pick a plate" />
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <h2 className="text-4xl font-medium">
          One craving.
          <br />
          <span className="text-brand">One table.</span>
        </h2>
        <p className="max-w-sm text-sm text-soft">
          Tell Nagrek what you feel like eating and we will find someone nearby who wants the same.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {cravings.map((c, i) => (
          <Link
            key={c.id}
            href="/sign-up"
            data-reveal-item
            className="group glass relative h-56 overflow-hidden rounded-3xl transition-[translate,box-shadow] duration-500 hover:-translate-y-2 hover:shadow-[0_24px_60px_-20px_#ff7e5f66] sm:h-64 md:h-80"
            aria-label={`Match over ${c.name}`}
          >
            <Image
              src={c.image}
              alt={`${c.name} — one of the cravings you can match over`}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover opacity-80 transition-[scale,opacity] duration-700 group-hover:scale-110 group-hover:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            <span className="absolute top-4 left-4 text-[9px] tracking-[0.2em] text-soft">0{i + 1}</span>
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2">
              <div>
                <strong className="font-heading text-2xl font-medium md:text-3xl">{c.name}</strong>
                <small className="block text-[10px] text-soft md:text-xs">{c.note}</small>
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-ink transition-transform group-hover:rotate-45">
                <ArrowUpRight className="size-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: Utensils, title: "Follow your craving.", text: "Biryani night? Coffee break? Tell us what is on your plate right now." },
    { icon: Radar, title: "Find your kind of hungry.", text: "We match on food, distance and conversation tone — professional or casual." },
    { icon: Video, title: "Say hi, then meet.", text: "A blurred 10-second preview, a quick live video, and you both decide." },
    { icon: ShieldCheck, title: "Safe by design.", text: "18+ only, report and block everywhere, approximate location only." },
  ];
  return (
    <section id="how-it-works" className="mx-auto max-w-[1440px] scroll-mt-20 border-t border-white/8 px-[6%] py-16 md:py-20" data-reveal>
      <Kicker left="02 / No reservation needed" right="Four little steps" />
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-4xl font-medium">
            Less small talk.
            <br />
            <span className="text-brand">More big bites.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-soft">
            The best connections do not need a perfect opening line. Just something delicious in common.
          </p>
          <span className="mt-6 block font-hand text-2xl text-peach">— Talk ⇄ Eat</span>
        </div>
        <ol className="border-t border-white/8">
          {steps.map((s, i) => (
            <li key={s.title} data-reveal-item className="group flex items-start gap-4 border-b border-white/8 py-6 transition-colors hover:bg-white/[0.02] sm:gap-6">
              <span className="min-w-10 font-heading text-xl text-peach transition-transform duration-300 group-hover:translate-x-1">0{i + 1}</span>
              <div className="flex-1">
                <h3 className="mb-1.5 text-base font-semibold">{s.title}</h3>
                <p className="text-sm text-soft">{s.text}</p>
              </div>
              <s.icon className="size-5 shrink-0 text-peach transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6" aria-hidden />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Marquee() {
  const items = [...marqueePairs, ...marqueePairs];
  return (
    <section aria-label="Cravings and the cities that love them" className="relative overflow-hidden border-y border-white/8 py-8">
      <span className="absolute top-2.5 left-[6%] text-[8px] tracking-[0.2em] text-soft">A COUNTRY OF CRAVINGS</span>
      <div className="animate-marquee flex w-max">
        {items.map((p, i) => (
          <div key={i} className="flex items-center gap-5 px-9 whitespace-nowrap">
            <span className="size-1.5 rounded-full bg-peach shadow-[0_0_12px_#ff936f]" />
            <span className="font-heading text-3xl font-medium">{p.food}</span>
            <span className="text-[11px] tracking-[0.2em] text-soft uppercase">{p.city}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlansTeaser() {
  const free = freePreview();
  return (
    <section id="plans" className="mx-auto max-w-[1440px] scroll-mt-20 px-[6%] py-16 md:py-20" data-reveal>
      <Kicker left="03 / Plans" right={free ? "Free during early access" : "30-day passes · no auto-renewal"} />
      <h2 className="mb-10 text-4xl font-medium">
        Pick your <span className="text-brand">appetite.</span>
      </h2>
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            data-reveal-item
            className={cn(
              "glass relative rounded-3xl p-7 transition-[translate,box-shadow] duration-500 hover:-translate-y-1.5",
              p.highlight && "ring-1 ring-peach/50 glow",
            )}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-[10px] font-bold text-ink">Most loved</span>
            )}
            <h3 className="text-xl font-medium">{p.name}</h3>
            <p className="text-xs text-soft">{p.tagline}</p>
            <p className="mt-5 font-heading text-4xl">
              {free ? (
                <>
                  Free <span className="text-base text-soft line-through">{formatInr(p.priceInr)}</span>
                </>
              ) : (
                formatInr(p.priceInr)
              )}
              <span className="text-sm text-soft">/30 days</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {p.perks.slice(0, 4).map((perk) => (
                <li key={perk} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-peach" aria-hidden /> {perk}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[1440px] scroll-mt-20 border-t border-white/8 px-[6%] py-16 md:py-20" data-reveal>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-4xl font-medium">
            Good questions,
            <br />
            <span className="text-brand">honest answers.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm text-soft">Everything you want to know before your first shared table.</p>
        </div>
        <div>
          {faqs.map((f) => (
            <details key={f.q} data-reveal-item className="group border-b border-white/8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-6 font-heading text-lg font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus className="size-5 shrink-0 text-peach transition-transform group-open:rotate-45" aria-hidden />
              </summary>
              <p className="max-w-xl pb-6 text-sm leading-relaxed text-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1440px] px-[6%] py-16 md:py-20" data-reveal>
      <div className="glass relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-8 sm:py-16">
        <div aria-hidden data-parallax="25" className="absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,#ff7e5f40,transparent_70%)]" />
        <h2 className="relative text-4xl font-medium md:text-5xl">
          Your next meal has a <span className="text-brand">seat for two.</span>
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-sm text-soft">Sign up, tell us your craving, and meet someone worth sharing it with.</p>
        <GradientLink href="/sign-up" size="lg" className="relative mt-8">
          Get started <ArrowUpRight />
        </GradientLink>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1440px] px-[6%] pt-16 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <p className="text-sm text-soft">Never eat alone. Talk ⇄ Eat.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-6 text-xs">
          <Link href="/legal/privacy" className="hover:text-peach">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-peach">Terms</Link>
          <Link href="/legal/guidelines" className="hover:text-peach">Community guidelines</Link>
          <a href="mailto:founder@nagrek.com" className="hover:text-peach">founder@nagrek.com</a>
        </nav>
      </div>
      <div aria-hidden className="text-outline my-6 font-heading text-[clamp(5rem,18vw,15rem)] leading-[0.85] font-bold tracking-[-0.06em] whitespace-nowrap select-none">
        nagrek.
      </div>
      <div className="flex flex-wrap justify-between gap-4 text-[10px] text-soft">
        <span>© 2026 Nagrek</span>
        <span>Made for real connection</span>
      </div>
    </footer>
  );
}
