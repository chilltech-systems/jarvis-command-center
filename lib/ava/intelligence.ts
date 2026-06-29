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
      title: `I found ${gmailAttention.attentionCount} Gmail item${gmailAttention.attentionCount === 1 ? "" : "s"} to review`,
      summary: `${gmailAccountSummary}. I saw ${gmailAttention.unreadCount} unread and ${gmailAttention.urgentCount} urgent. I did not fetch full message bodies.`,
      severity: gmailAttention.urgentCount > 0 ? "urgent" : gmailAttention.unreadCount > 0 ? "warning" : "normal",
      action: "Review Email",
    }] : gmail ? [{
      id: "live-gmail-connector",
      timestamp: "Live",
      category: "email",
      title: "I can see the Gmail connector",
      summary: gmailAttention.error
        ? `Gmail is configured, but I could not complete the live attention check yet: ${gmailAttention.error}`
        : `I saw ${gmail.metrics?.inboxUnread || 0} unread inbox messages and ${gmail.metrics?.unreadThreads || 0} unread threads in the latest read-only check.`,
      severity: Number(gmail.metrics?.unreadThreads || 0) > 25 ? "warning" : "normal",
      action: "Review Email",
    }] : []),
    ...(slack ? [{
      id: "live-slack-connector",
      timestamp: "Live",
      category: "personal",
      title: "I can see Slack metadata",
      summary: "I confirmed read access to Slack conversation metadata through the Codex connector. I did not change n8n workflow configuration.",
      severity: "normal",
      action: "Review Slack",
    }] : []),
    ...(completedTasks.completedCount > 0 ? [{
      id: "live-todoist-completed",
      timestamp: "Live",
      category: "task",
      title: `I saw ${completedTasks.completedCount} Todoist task${completedTasks.completedCount === 1 ? "" : "s"} completed today`,
      summary: completedTasks.completedSummary,
      severity: "normal",
      action: "Review Debrief",
    }] : []),
    {
      id: "live-todoist",
      timestamp: "Live",
      category: "task",
      title: `I loaded ${tasks.tasks.length} Todoist item${tasks.tasks.length === 1 ? "" : "s"}`,
      summary: `I found ${tasks.groups.scheduled.length} scheduled for calendar, ${tasks.groups.unscheduled.length} unscheduled in the background, and ${tasks.groups.overdue.length} overdue.`,
      severity: tasks.groups.overdue.length ? "warning" : "normal",
      action: "Open Tasks",
    },
    {
      id: "live-weather",
      timestamp: "Live",
      category: "weather",
      title: `I am tracking ${weather.temperature}° and ${weather.condition.toLowerCase()}`,
      summary: `I see a high of ${weather.high}°, low of ${weather.low}°, and ${weather.rainChance}% rain chance. ${weather.recommendation}`,
      severity: weather.rainChance >= 50 || /thunder|storm|heavy/i.test(weather.condition) ? "warning" : "normal",
      action: "Review Weather",
    },
    {
      id: "live-projects",
      timestamp: "Live",
      category: "project",
      title: `I found ${projectSummary.count} local project records`,
      summary: `I am keeping ${projectSummary.active} active, ready, or prototyped projects close in the local workspace registry.`,
      severity: "normal",
      action: "Open Projects",
    },
    ...intelligenceFeed,
  ];
}
