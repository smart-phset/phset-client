"use client";
import { useState } from "react";
import { AINotificationCenter } from "@/features/ai-alerts/AINotificationCenter";
import { PrototypeAlerts } from "@/components/PrototypeAlerts";

export default function AlertsPage() {
  const [tab, setTab] = useState<"ai" | "prototype">("ai");
  return <>
    <nav aria-label="Notification views" className="flex gap-2 px-4 md:px-6 pt-5">
      <button type="button" aria-pressed={tab === "ai"} onClick={() => setTab("ai")}
        className={`rounded-lg px-4 py-2 font-semibold ${tab === "ai" ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}>AI notifications</button>
      <button type="button" aria-pressed={tab === "prototype"} onClick={() => setTab("prototype")}
        className={`rounded-lg px-4 py-2 font-semibold ${tab === "prototype" ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}>Prototype alerts</button>
    </nav>
    {tab === "ai" ? <AINotificationCenter /> : <PrototypeAlerts />}
  </>;
}
