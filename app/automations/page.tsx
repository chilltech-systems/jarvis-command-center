import { AvaPageShell } from "@/app/components/ava-shell";
import { AutomationsStatusCenter } from "@/app/components/automations-status-center";

export default function AutomationsPage() {
  return (
    <AvaPageShell eyebrow="Ava Automations" title="Automations" subtitle="I am watching n8n health, failures, review signals, and operational telemetry.">
      <AutomationsStatusCenter />
    </AvaPageShell>
  );
}
