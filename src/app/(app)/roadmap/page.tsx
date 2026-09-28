import type { Metadata } from "next";
import { RoadmapView } from "@/components/roadmap-view";

export const metadata: Metadata = { title: "Roadmap" };

export default function RoadmapPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">6 weeks · 42 days</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Roadmap</h1>
        <p className="mt-1.5 max-w-2xl text-ink-2">Days are a sequence, not fixed dates. Miss one and nothing locks; just pick up where you left off.</p>
      </div>
      <RoadmapView />
    </div>
  );
}
