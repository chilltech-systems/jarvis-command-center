import type { JarvisIntegration } from "@/lib/jarvis/types";

export const JARVIS_INTEGRATIONS: JarvisIntegration[] = [
  { key: "supabase", name: "Supabase", category: "Data", status: "Connected", permission: "execute", credentialEnvironmentKeys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], capabilities: ["Authentication", "Monitoring data", "Assistant audit storage"], notes: "Primary Jarvis data and authentication layer." },
  { key: "vercel", name: "Vercel", category: "Platform", status: "Connected", permission: "read_only", credentialEnvironmentKeys: ["VERCEL"], capabilities: ["HUD hosting", "Server-side API routes"], notes: "Hosts the private Jarvis Command Center." },
  { key: "github", name: "GitHub", category: "Development", status: "Connected", permission: "draft", credentialEnvironmentKeys: ["GITHUB_TOKEN"], capabilities: ["Repository context", "Future pull requests"], notes: "Repository is connected to the deployment pipeline." },
  { key: "n8n", name: "n8n", category: "Automation", status: "Connected", permission: "requires_approval", credentialEnvironmentKeys: ["N8N_API_URL", "N8N_API_KEY"], capabilities: ["Workflow status", "Execution monitoring", "Future approved triggers"], notes: "Monitoring data is connected through Supabase." },
  { key: "openai", name: "OpenAI", category: "Intelligence", status: "Connected", permission: "execute", credentialEnvironmentKeys: ["OPENAI_API_KEY"], capabilities: ["Assistant reasoning", "Tool-aware responses", "Summarization"], notes: "Uses the server-side Responses API while Jarvis retains deterministic permission and approval enforcement." },
  { key: "gmail", name: "Google Gmail", category: "Communication", status: "Credential Needed", permission: "requires_approval", credentialEnvironmentKeys: ["GOOGLE_GMAIL_CREDENTIAL"], capabilities: ["Read email", "Summarize inbox", "Draft replies", "Approved sending"], notes: "Requires scoped server-side Google credentials." },
  { key: "google_calendar", name: "Google Calendar", category: "Scheduling", status: "Credential Needed", permission: "requires_approval", credentialEnvironmentKeys: ["GOOGLE_CALENDAR_CREDENTIAL"], capabilities: ["Read schedule", "Detect conflicts", "Draft events"], notes: "Requires scoped server-side Google credentials." },
  { key: "google_drive", name: "Google Drive", category: "Knowledge", status: "Credential Needed", permission: "read_only", credentialEnvironmentKeys: ["GOOGLE_DRIVE_CREDENTIAL"], capabilities: ["Search files", "Knowledge ingestion"], notes: "Assistant access remains separate from n8n credentials." },
  { key: "slack", name: "Slack", category: "Communication", status: "Credential Needed", permission: "requires_approval", credentialEnvironmentKeys: ["SLACK_BOT_TOKEN"], capabilities: ["Read updates", "Draft messages", "Approved sending"], notes: "Requires a dedicated scoped Jarvis bot credential." },
  { key: "codex", name: "Codex", category: "Development", status: "Connected", permission: "requires_approval", credentialEnvironmentKeys: ["SUPABASE_SERVICE_ROLE_KEY"], capabilities: ["Create task briefs", "Approved local runner queue", "Architecture context"], notes: "Jarvis queues approved Codex prompt packages for a local Mac runner. Service-role key is used only by the local runner, never in the browser." },
  { key: "business_data", name: "Business Data Sources", category: "Business Intelligence", status: "In Progress", permission: "read_only", credentialEnvironmentKeys: [], capabilities: ["Sales", "Labor", "Catering", "Operations metrics"], notes: "Existing Jarvis pulses are the first connected business signals." },
  { key: "project_knowledge", name: "Project Knowledge", category: "Knowledge", status: "Ready To Configure", permission: "read_only", credentialEnvironmentKeys: [], capabilities: ["Documentation search", "Architecture notes", "System explanations"], notes: "Memory and knowledge schemas are ready for future ingestion." },
  { key: "twilio", name: "Twilio", category: "Communication", status: "Future", permission: "requires_approval", credentialEnvironmentKeys: [], capabilities: ["Calls", "SMS"], notes: "Future integration." },
  { key: "stripe", name: "Stripe", category: "Finance", status: "Future", permission: "requires_approval", credentialEnvironmentKeys: [], capabilities: ["Payments", "Revenue context"], notes: "Future integration." },
];

export function discoverIntegrationCredentials() {
  return JARVIS_INTEGRATIONS.map((integration) => {
    const configuredKeys = integration.credentialEnvironmentKeys.filter((key) => Boolean(process.env[key]));
    const credentialsReady = integration.credentialEnvironmentKeys.length > 0
      && configuredKeys.length === integration.credentialEnvironmentKeys.length;

    return {
      ...integration,
      configuredCredentialCount: configuredKeys.length,
      requiredCredentialCount: integration.credentialEnvironmentKeys.length,
      credentialsReady,
    };
  });
}
