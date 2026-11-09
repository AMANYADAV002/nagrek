import { Guard } from "@/components/guard";

/** Full-screen meeting surfaces (pre-meet, room, feedback). Requires an active plan. */
export default function MeetingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard need="plan">
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    </Guard>
  );
}
