import { LogoMark } from "@/components/icons";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent opacity-[0.07] blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-11" />
          <p className="mt-4 font-display text-xl font-semibold tracking-tight">CCA-F Roadmap</p>
          <p className="mt-1 text-sm text-ink-3">42 days to the Claude Certified Architect – Foundations exam</p>
        </div>
        {children}
      </div>
    </main>
  );
}
