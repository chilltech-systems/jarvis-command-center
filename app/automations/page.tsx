import { AvaPageShell } from "@/app/components/ava-shell";
import { AutomationsStatusCenter } from "@/app/components/automations-status-center";

export default function AutomationsPage() {
  return (
    <AvaPageShell eyebrow="Ava Automations" title="Automations" subtitle="Live n8n workflow health, failures, review signals, and operational telemetry.">
      <AutomationsStatusCenter />
    </AvaPageShell>
  );
}
