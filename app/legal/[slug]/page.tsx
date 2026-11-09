import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { GlassCard } from "@/components/glass/glass-card";
import { guidelinesSections, privacySections, termsSections, TERMS_VERSION, type LegalSection } from "@/lib/data/legal";

const docs: Record<string, { title: string; sections: LegalSection[] }> = {
  terms: { title: "Terms of Service", sections: termsSections },
  privacy: { title: "Privacy Policy", sections: privacySections },
  guidelines: { title: "Community Guidelines", sections: guidelinesSections },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(docs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: docs[slug]?.title ?? "Legal" };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  const doc = docs[slug];
  if (!doc) notFound();

  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-10 md:py-16">
      <div className="mb-10 flex items-center justify-between">
        <Wordmark />
        <Link href="/" className="flex items-center gap-1.5 text-sm text-soft hover:text-cream">
          <ArrowLeft className="size-4" aria-hidden /> Home
        </Link>
      </div>
      <h1 className="text-4xl font-medium md:text-5xl">{doc.title}</h1>
      <p className="mt-3 text-sm text-soft">Version {TERMS_VERSION}</p>
      <p role="note" className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        Draft. This text has not been reviewed by a lawyer yet and is not final.
      </p>
      <nav aria-label="Legal documents" className="mt-6 flex flex-wrap gap-2 text-sm">
        {Object.entries(docs).map(([key, d]) => (
          <Link key={key} href={`/legal/${key}`} aria-current={key === slug ? "page" : undefined} className={key === slug ? "rounded-full bg-brand px-3 py-1 text-ink" : "rounded-full bg-white/5 px-3 py-1 text-soft hover:text-cream"}>
            {d.title}
          </Link>
        ))}
      </nav>
      <GlassCard className="mt-8 space-y-8 p-6 md:p-10">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-3 text-xl font-medium">{s.heading}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-cream/80">
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        ))}
      </GlassCard>
    </main>
  );
}
