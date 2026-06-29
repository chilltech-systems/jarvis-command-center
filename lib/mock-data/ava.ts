export const weather = {
  location: "The Woodlands, TX",
  temperature: 84,
  condition: "Humid with building storms",
  high: 91,
  low: 76,
  rainChance: 58,
  recommendation: "Keep outdoor errands before late afternoon and leave buffer time for evening travel.",
};

export const calendarEvents = [
  { id: "cal-1", title: "Operations planning block", time: "9:00 AM", duration: "45 min", location: "Home office", type: "focus" },
  { id: "cal-2", title: "Client automation review", time: "11:30 AM", duration: "30 min", location: "Google Meet", type: "meeting" },
  { id: "cal-3", title: "CHILL TECH build review", time: "2:00 PM", duration: "60 min", location: "Desk", type: "project" },
];

export const upcomingEvents = [
  { id: "cal-4", title: "MarketBrief roadmap pass", date: "Tomorrow", time: "10:00 AM" },
  { id: "cal-5", title: "Athena systems review", date: "Wednesday", time: "1:30 PM" },
  { id: "cal-6", title: "Client portal generator QA", date: "Friday", time: "9:00 AM" },
];

export const freeBlocks = [
  { id: "free-1", label: "Deep work", time: "12:15 PM - 1:45 PM" },
  { id: "free-2", label: "Admin cleanup", time: "3:30 PM - 4:30 PM" },
];

export const tasks = [
  { id: "task-1", title: "Review failed automation summary", dueDate: "Today", priority: 1, project: "Ava", status: "due_today", source: "Todoist" },
  { id: "task-2", title: "Update CHILL TECH mobile proof notes", dueDate: "Today", priority: 2, project: "CHILL TECH Website", status: "due_today", source: "Todoist" },
  { id: "task-3", title: "Draft MarketBrief ingestion checklist", dueDate: "Today", priority: 2, project: "MarketBrief", status: "due_today", source: "Todoist" },
  { id: "task-4", title: "Confirm missed-call workflow handoff", dueDate: "Today", priority: 3, project: "Missed Call Text Back", status: "due_today", source: "Todoist" },
  { id: "task-5", title: "Close stale BB360 note", dueDate: "Yesterday", priority: 1, project: "Operations", status: "overdue", source: "Todoist" },
  { id: "task-6", title: "Prepare Globe Watch source list", dueDate: "Tomorrow", priority: 3, project: "Globe Watch", status: "upcoming", source: "Todoist" },
  { id: "task-7", title: "Log Baby BP Tracker MVP scope", dueDate: "Today", priority: 4, project: "Baby BP Tracker", status: "completed", source: "Todoist" },
];

export const projects = [
  { name: "Ava", description: "Personal and business AI operating system dashboard.", status: "Active", phase: "Rebuild", nextAction: "Finish shell and mock integrations", lastUpdated: "Today", relatedSystems: ["Supabase", "n8n", "OpenAI"], link: "#" },
  { name: "CHILL TECH Website", description: "Premium public site for CHILL TECH positioning and proof.", status: "Active", phase: "Local polish", nextAction: "Verify mobile route updates", lastUpdated: "Yesterday", relatedSystems: ["Next.js", "Vercel"], link: "#" },
  { name: "MarketBrief", description: "Market intelligence and briefing workflow.", status: "Planning", phase: "Data sources", nextAction: "Confirm ingestion sources", lastUpdated: "This week", relatedSystems: ["APIs", "OpenAI"], link: "#" },
  { name: "Missed Call Text Back", description: "n8n SMS response system for missed calls.", status: "Ready", phase: "Workflow review", nextAction: "Connect production credentials", lastUpdated: "This month", relatedSystems: ["n8n", "Twilio"], link: "#" },
  { name: "Globe Watch", description: "Signal tracking for world events and risk context.", status: "Concept", phase: "MVP scope", nextAction: "Define event categories", lastUpdated: "This week", relatedSystems: ["News APIs", "OpenAI"], link: "#" },
  { name: "Baby BP Tracker", description: "Personal health tracking utility for blood pressure logs.", status: "Prototype", phase: "Input model", nextAction: "Shape daily logging view", lastUpdated: "Today", relatedSystems: ["Local app", "Charts"], link: "#" },
  { name: "Client Portal Generator", description: "Reusable portal scaffolder for client-facing systems.", status: "Backlog", phase: "Template design", nextAction: "Choose starter stack", lastUpdated: "This week", relatedSystems: ["Next.js", "Supabase"], link: "#" },
];

export const automationSnapshot = {
  healthyWorkflows: 12,
  failedWorkflows: 1,
  warningWorkflows: 2,
  latestFailure: "Morning standup delivery retry needed after outbound policy block.",
  recentErrors: [
    "Slack delivery returned a retryable network failure.",
    "One monitoring workflow missed its expected heartbeat.",
  ],
  suggestedFix: "Review the failed execution, confirm webhook reachability, then retry from the approved local sender path.",
};

export const intelligenceFeed = [
  { id: "intel-1", timestamp: "8:05 AM", category: "calendar", title: "Two meeting blocks today", summary: "The first hard stop is at 11:30 AM, with a useful work block before lunch.", severity: "normal", action: "Review schedule" },
  { id: "intel-2", timestamp: "8:12 AM", category: "task", title: "One overdue high-priority task", summary: "The automation review should be cleared before new build work starts.", severity: "high", action: "Open tasks" },
  { id: "intel-3", timestamp: "8:18 AM", category: "weather", title: "Storm risk this evening", summary: "Rain chance rises later today, so travel buffers should be protected.", severity: "warning", action: "Check forecast" },
  { id: "intel-4", timestamp: "8:24 AM", category: "automation", title: "Automation needs review", summary: "One workflow has a recent failure and two are in warning state.", severity: "warning", action: "Open Automations" },
  { id: "intel-5", timestamp: "8:31 AM", category: "project", title: "Ava rebuild is the active build", summary: "The dashboard shell is the highest leverage project today.", severity: "normal", action: "Open projects" },
  { id: "intel-6", timestamp: "8:40 AM", category: "email", title: "Inbox triage placeholder", summary: "Email connection is not live yet; this feed is ready for Gmail signals.", severity: "normal", action: "Connect Gmail" },
  { id: "intel-7", timestamp: "8:47 AM", category: "market", title: "MarketBrief source gap", summary: "MarketBrief needs confirmed source inputs before live summaries.", severity: "normal", action: "Open project" },
  { id: "intel-8", timestamp: "8:55 AM", category: "personal", title: "Protect one focus block", summary: "A clean 90-minute window is available after lunch.", severity: "normal", action: "Block time" },
];

export const dailyBrief = {
  summary: "Ava found 2 events that need attention, 4 scheduled tasks due today, one automation to review, and a clean focus block after lunch.",
  scheduleOverview: "Three events are on the calendar, with the next meeting at 11:30 AM.",
  taskPriorities: "Clear the automation review first, then finish CHILL TECH proof notes and MarketBrief source planning.",
  weatherImpact: "Storms may move in this evening. Keep outside errands early and avoid tight travel windows.",
  businessPulse: "Ava and CHILL TECH Website are the active systems. MarketBrief is waiting on data-source decisions.",
  automationIssues: automationSnapshot.latestFailure,
  suggestedFocus: "Use the morning for implementation and the early afternoon for review and documentation.",
  personalNotes: "Protect the 12:15 PM focus block and keep the evening lighter if storms arrive.",
};

export function taskGroups() {
  return {
    overdue: tasks.filter((task) => task.status === "overdue"),
    today: tasks.filter((task) => task.status === "due_today"),
    upcoming: tasks.filter((task) => task.status === "upcoming"),
    highPriority: tasks.filter((task) => task.priority <= 2 && task.status !== "completed"),
    completedToday: tasks.filter((task) => task.status === "completed"),
  };
}

export function avaPayload() {
  return {
    weather,
    calendar: { today: calendarEvents, upcoming: upcomingEvents, freeBlocks },
    tasks,
    taskGroups: taskGroups(),
    projects,
    automations: automationSnapshot,
    intelligenceFeed,
    dailyBrief,
  };
}
