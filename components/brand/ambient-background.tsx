export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -right-32 size-[42rem] rounded-full bg-[radial-gradient(ellipse,#ff7e5f1f,transparent_65%)] blur-2xl" />
      <div className="absolute -bottom-52 -left-40 size-[38rem] rounded-full bg-[radial-gradient(ellipse,#feb47b14,transparent_65%)] blur-2xl" />
      <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}
