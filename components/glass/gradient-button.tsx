import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const gradientButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-200 select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-peach active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        brand: "bg-brand text-ink glow hover:-translate-y-0.5 hover:shadow-[0_8px_48px_-4px_rgb(255_126_95/0.65)]",
        glass: "glass text-cream hover:bg-white/10",
        outline: "border border-white/15 text-cream hover:border-peach/60 hover:text-peach",
        ghost: "text-soft hover:text-cream hover:bg-white/5",
        danger: "bg-red-500/15 text-red-300 border border-red-400/30 hover:bg-red-500/25",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-12 px-6 text-sm",
        lg: "h-14 px-8 text-base",
        icon: "size-12",
      },
    },
    defaultVariants: { variant: "brand", size: "md" },
  },
);

type Variants = VariantProps<typeof gradientButtonVariants>;

export function GradientButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & Variants) {
  return <button className={cn(gradientButtonVariants({ variant, size }), className)} {...props} />;
}

export function GradientLink({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Link> & Variants) {
  return <Link className={cn(gradientButtonVariants({ variant, size }), className)} {...props} />;
}
