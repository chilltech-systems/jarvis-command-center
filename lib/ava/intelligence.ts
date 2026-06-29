import { getAvaTasks } from "@/lib/ava/todoist";
import { getAvaWeather } from "@/lib/ava/weather";
import { getProjectSummary } from "@/lib/ava/projects";
import { getConnectorSnapshots } from "@/lib/ava/connector-snapshot";
import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";
import { getAvaGmailAttention } from "@/lib/ava/gmail-attention";
import { intelligenceFeed } from "@/lib/mock-data/ava";

export async function getAvaIntelligenceFeed() {
  const [tasks, completedTasks, weather, projectSummary, gmailAttention] = await Promise.all([
    getAvaTasks(),
    getAvaCompletedTasks(),
    getAvaWeather(),
    Promise.resolve(getProjectSummary()),
    getAvaGmailAttention(),
  ]);
  const connectorSnapshots = getConnectorSnapshots();
  const gmail = connectorSnapshots.find((snapshot) => snapshot.id === "codex-gmail");
  const slack = connectorSnapshots.find((snapshot) => snapshot.id === "codex-slack");
  const gmailAccountSummary = gmailAttention.accounts
    .filter((account) => account.attentionCount > 0)
    .map((account) => `${account.label} ${account.attentionCount}`)
    .join(" · ");

  return [
    ...(gmailAttention.attentionCount > 0 ? [{
      id: "live-gmail-attention",
      timestamp: "Live",
      category: "email",
      title: `${gmailAttention.attentionCount} Gmail items need review`,
      summary: `${gmailAccountSummary}. ${gmailAttention.unreadCount} unread, ${gmailAttention.urgentCount} urgent. Full message bodies were not fetched.`,
      severity: gmailAttention.urgentCount > 0 ? "urgent" : gmailAttention.unreadCount > 0 ? "warning" : "normal",
      action: "Review Email",
    }] : gmail ? [{
      id: "live-gmail-connector",
      timestamp: "Live",
      category: "email",
      title: "Gmail connector available",
      summary: gmailAttention.error
        ? `Gmail connector is configured, but live attention lookup is not available yet: ${gmailAttention.error}`
        : `${gmail.metrics?.inboxUnread || 0} unread inbox messages and ${gmail.metrics?.unreadThreads || 0} unread threads were visible in the latest read-only connector check.`,
      severity: Number(gmail.metrics?.unreadThreads || 0) > 25 ? "warning" : "normal",
      action: "Review Email",
    }] : []),
    ...(slack ? [{
      id: "live-slack-connector",
      timestamp: "Live",
      category: "personal",
      title: "Slack connector available",
      summary: `Ava confirmed read access to Slack conversation metadata through the Codex connector. n8n workflow configuration was not changed.`,
      severity: "normal",
      action: "Review Slack",
    }] : []),
    ...(completedTasks.completedCount > 0 ? [{
      id: "live-todoist-completed",
      timestamp: "Live",
      category: "task",
      title: `${completedTasks.completedCount} Todoist tasks completed today`,
      summary: completedTasks.completedSummary,
      severity: "normal",
      action: "Review Debrief",
    }] : []),
    {
      id: "live-todoist",
      timestamp: "Live",
      category: "task",
      title: `${tasks.tasks.length} Todoist items loaded`,
      summary: `${tasks.groups.scheduled.length} scheduled for calendar, ${tasks.groups.unscheduled.length} unscheduled to-do items, ${tasks.groups.overdue.length} overdue.`,
      severity: tasks.groups.overdue.length ? "warning" : "normal",
      action: "Open Tasks",
    },
    {
      id: "live-weather",
      timestamp: "Live",
      category: "weather",
      title: `${weather.temperature}° and ${weather.condition}`,
      summary: `High ${weather.high}°, low ${weather.low}°, rain chance ${weather.rainChance}%. ${weather.recommendation}`,
      severity: weather.rainChance >= 50 || /thunder|storm|heavy/i.test(weather.condition) ? "warning" : "normal",
      action: "Review Weather",
    },
    {
      id: "live-projects",
      timestamp: "Live",
      category: "project",
      title: `${projectSummary.count} local project records available`,
      summary: `${projectSummary.active} projects are active, ready, or prototyped in the local workspace registry.`,
      severity: "normal",
      action: "Open Projects",
    },
    ...intelligenceFeed,
  ];
}
