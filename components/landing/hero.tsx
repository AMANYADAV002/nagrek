import { ArrowDown, ArrowLeftRight, ArrowUpRight, Video } from "lucide-react";
import { GradientLink } from "@/components/glass/gradient-button";
import { Eyebrow } from "@/components/glass/section-heading";
import { HeroOrbit } from "@/components/landing/hero-orbit";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1440px] flex-col justify-center overflow-hidden px-[6%] pt-10 pb-28 md:min-h-[calc(100svh-5rem)] lg:flex-row lg:items-center lg:gap-10 lg:pt-12">
      <div aria-hidden className="drift absolute -top-16 -right-20 -z-10 size-[min(40rem,120vw)] rounded-full bg-[radial-gradient(ellipse,#ff7e5f26,transparent_67%)]" style={{ "--t": "14s" } as React.CSSProperties} />
      <div aria-hidden className="drift absolute bottom-0 -left-40 -z-10 size-[min(32rem,100vw)] rounded-full bg-[radial-gradient(ellipse,#feb47b14,transparent_67%)]" style={{ "--t": "18s", "--d": "-6s" } as React.CSSProperties} />

      <div className="relative z-10 text-center lg:w-[58%] lg:text-left">
        <div className="enter-rise flex justify-center lg:justify-start" style={delay(0)}>
          <Eyebrow>Good food. Real connections.</Eyebrow>
        </div>

        <p className="enter-pop glass mt-6 inline-flex items-center gap-3 rounded-full px-4 py-2 font-heading text-sm" style={delay(100)}>
          Talk <ArrowLeftRight className="size-4 text-peach" aria-label="and" /> Eat
        </p>

        <h1 className="mt-6 font-heading text-[clamp(3rem,11vw,7rem)] leading-[0.98] font-medium tracking-[-0.05em]">
          {["Never eat", "alone."].map((line, i) => (
            <span key={line} className="block overflow-hidden pb-1">
              <span className={`enter-line block ${i === 1 ? "text-brand" : ""}`} style={delay(150 + i * 130)}>
                {line}
              </span>
            </span>
          ))}
        </h1>

        <p className="enter-rise mx-auto mt-5 max-w-md text-base leading-relaxed text-soft lg:mx-0" style={delay(450)}>
          <span className="block font-medium text-cream">Connection is on the menu.</span>
          Match with someone nearby who is craving the same thing, say hi on a quick live video, then share a table.
        </p>

        <div className="enter-rise mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start" style={delay(600)}>
          <GradientLink href="/sign-up" size="lg">
            Start eating together <ArrowUpRight />
          </GradientLink>
          <GradientLink href="#how-it-works" variant="outline" size="lg">
            How it works
          </GradientLink>
        </div>
        <p className="enter-rise mt-5 flex items-center justify-center gap-2 text-xs text-soft lg:justify-start" style={delay(750)}>
          <Video className="size-3.5 text-peach" aria-hidden /> Live video. Shared cravings. 18+ only.
        </p>
      </div>

      <HeroOrbit />

      <div className="enter-rise absolute inset-x-[6%] bottom-6 flex items-center justify-between border-t border-white/8 pt-5 text-[9px] tracking-[0.15em] text-soft" style={delay(1000)}>
        <span className="hidden sm:inline">LESS SCROLLING. MORE SHARING.</span>
        <a href="#cravings" className="group mx-auto flex items-center gap-2 text-xs tracking-normal hover:text-peach sm:mx-0">
          Find your table <ArrowDown className="size-4 transition-transform group-hover:translate-y-1" />
        </a>
        <span className="hidden sm:inline">EST. FOR TOGETHERNESS</span>
      </div>
    </section>
  );
}
