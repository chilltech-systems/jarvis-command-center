import fs from "node:fs";
import { connectedToolHubAccounts, toolHubConfigured } from "@/lib/jarvis/tool-hub";
import { getConnectorSnapshots } from "@/lib/ava/connector-snapshot";

function exists(path: string) {
  return fs.existsSync(path);
}

function readJson(path: string) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getAvaConnections() {
  const credentialCatalog = readJson("/Users/c.hill/Documents/Projects/jarvis-tool-hub/schemas/credential-routing-catalog.json") as {
    accounts?: Record<string, Record<string, { status?: string }>>;
  };
  const accounts = credentialCatalog.accounts || {};
  const connectedCount = (service: string) => connectedToolHubAccounts(service).length
    || Object.values(accounts[service] || {}).filter((entry) => entry.status === "connected").length;
  const statusFor = (service: string) => connectedCount(service) > 0 ? "Connected" : "Not Connected";
  const sourceFor = (service: string) => {
    const count = connectedCount(service);
    return count ? `Tool Hub credential catalog · ${count} account${count === 1 ? "" : "s"}` : "Tool Hub credential catalog";
  };

  const codexSnapshots = getConnectorSnapshots();
  const codexStatus = (name: string) => codexSnapshots.find((snapshot) => snapshot.name === name)?.status;

  return [
    { name: "Todoist", category: "Tasks and calendar", status: toolHubConfigured() && connectedCount("todoist") > 0 ? "Connected" : "Needs Review", source: "n8n Tool Hub" },
    { name: "Weather", category: "Personal context", status: "Connected", source: "Open-Meteo" },
    { name: "n8n", category: "Automations", status: exists("/Users/c.hill/Documents/Projects/.secrets/n8n.env") ? "Connected" : "Needs Review", source: "Local n8n env" },
    { name: "Supabase", category: "Ava data", status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Connected" : "Needs Review", source: "App env" },
    { name: "Google Calendar", category: "Schedule", status: statusFor("googleCalendar"), source: sourceFor("googleCalendar") },
    { name: "Gmail", category: "Communication", status: codexStatus("Gmail") || (connectedCount("gmail") > 0 ? "Credential Found" : "Not Connected"), source: codexStatus("Gmail") ? "Codex connector" : "n8n credential catalog" },
    { name: "Google Drive", category: "Files and docs", status: codexStatus("Google Drive") || "Not Connected", source: codexStatus("Google Drive") ? "Codex connector" : "Workspace connector" },
    { name: "Google Sheets", category: "Business data", status: statusFor("googleSheets"), source: sourceFor("googleSheets") },
    { name: "Slack", category: "Communication", status: codexStatus("Slack") || (connectedCount("slack") > 0 ? "Credential Found" : "Not Connected"), source: codexStatus("Slack") ? "Codex connector" : "n8n credential catalog" },
    { name: "Twilio", category: "SMS and calls", status: statusFor("twilio"), source: sourceFor("twilio") },
  ];
}
