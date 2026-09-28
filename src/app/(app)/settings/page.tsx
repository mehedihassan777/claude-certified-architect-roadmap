import type { Metadata } from "next";
import { SettingsPanels } from "@/components/settings-panels";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-1.5 text-ink-2">Your schedule and your data. Progress is saved to your account and syncs across your devices.</p>
      </div>
      <SettingsPanels />
    </div>
  );
}
