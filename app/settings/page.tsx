import { AvaPageShell, SectionHeader, StatusPill } from "@/app/components/ava-shell";
import { getAvaConnections } from "@/lib/ava/connections";
import { getConnectorSnapshots } from "@/lib/ava/connector-snapshot";

const settings = [
  "Profile",
  "Connected Apps",
  "API Keys",
  "Weather Location",
  "Calendar Connection",
  "Todoist Connection",
  "n8n Connection",
  "OpenAI Connection",
  "Theme",
  "Notification Preferences",
];

export default function SettingsPage() {
  const connections = getAvaConnections();
  const connectorSnapshots = getConnectorSnapshots();
  return (
    <AvaPageShell eyebrow="Ava Settings" title="Settings" subtitle="Connection placeholders and preferences for future live integrations.">
      <section className="panel">
        <SectionHeader title="Detected Connections" action={<StatusPill tone="good">{connections.filter((connection) => connection.status === "Connected").length} live</StatusPill>} />
        <div className="connection-grid">
          {connections.map((connection) => <div className="connection-item" key={connection.name}><div><strong>{connection.name}</strong><span>{connection.category} · {connection.source}</span></div><StatusPill tone={connection.status === "Connected" ? "good" : connection.status === "Credential Found" ? "warning" : "normal"}>{connection.status}</StatusPill></div>)}
        </div>
      </section>
      <section className="panel">
        <SectionHeader title="Codex Connector Snapshot" action={<StatusPill tone="good">{connectorSnapshots.length} confirmed</StatusPill>} />
        <div className="connection-grid">
          {connectorSnapshots.map((connector) => <div className="connection-item" key={connector.id}><div><strong>{connector.name}</strong><span>{connector.summary} Updated {new Date(connector.updatedAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</span></div><StatusPill tone="good">{connector.status}</StatusPill></div>)}
        </div>
      </section>
      <section className="grid settings-grid">
        {settings.map((setting) => <article className="panel" key={setting}><SectionHeader title={setting} action={<StatusPill tone="warning">Placeholder</StatusPill>} /><p className="subtle">Configuration surface reserved. Secrets will stay server-side and will not be exposed to the browser.</p></article>)}
      </section>
    </AvaPageShell>
  );
}
