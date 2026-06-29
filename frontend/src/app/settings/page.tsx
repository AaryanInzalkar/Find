"use client";

/**
 * Settings page. Phase 5.1 ships the hardware-acceleration section wired to a
 * real backend (`/api/config/hardware`). Additional groups (library/storage,
 * ML, sharing, appearance, advanced) land as their backends do — we avoid
 * stubbing groups with no persistence behind them (YAGNI).
 */

import { useState } from "react";
import { HardwareAccelSettings } from "@/components/hardware-accel-settings";
import type { AccelMode } from "@/lib/api";

export default function SettingsPage() {
  const [accelMode, setAccelMode] = useState<AccelMode | undefined>(undefined);

  return (
    <main className="settings-page">
      <h1>Settings</h1>
      <HardwareAccelSettings value={accelMode} onChange={setAccelMode} />
    </main>
  );
}
