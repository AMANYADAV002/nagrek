import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { CravingGrid, Faq, FinalCta, HowItWorks, Marquee, PlansTeaser, SiteFooter } from "@/components/landing/sections";
import { GsapReveal } from "@/components/motion/gsap-reveal";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Marquee />
        <GsapReveal>
          <CravingGrid />
          <HowItWorks />
          <PlansTeaser />
          <Faq />
          <FinalCta />
        </GsapReveal>
      </main>
      <SiteFooter />
    </>
  );
}
