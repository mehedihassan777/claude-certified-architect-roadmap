import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-6xl font-semibold text-accent">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">This page isn&apos;t on the roadmap</h1>
      <p className="mt-2 text-ink-2">The plan runs from Day 1 to Day 42.</p>
      <Link href="/roadmap" className={`${buttonStyles.primary} mt-6`}>
        Back to the roadmap
      </Link>
    </div>
  );
}
