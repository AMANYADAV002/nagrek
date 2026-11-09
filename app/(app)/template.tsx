import { PageTransition } from "@/components/motion/page-transition";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
