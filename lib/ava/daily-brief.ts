import { getAvaTasks } from "@/lib/ava/todoist";
import { getAvaWeather } from "@/lib/ava/weather";
import { getProjectSummary } from "@/lib/ava/projects";
import { automationSnapshot } from "@/lib/mock-data/ava";
import { getCentralGreeting } from "@/lib/ava/time";
import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";

export async function getAvaDailyBrief() {
  const [tasks, completedTasks, weather, projects] = await Promise.all([
    getAvaTasks(),
    getAvaCompletedTasks(),
    getAvaWeather(),
    Promise.resolve(getProjectSummary()),
  ]);

  const completedClause = completedTasks.completedCount > 0 ? ` You completed ${completedTasks.completedCount} Todoist task${completedTasks.completedCount === 1 ? "" : "s"} today.` : "";
  const overdueLabel = `${tasks.groups.overdue.length} item${tasks.groups.overdue.length === 1 ? "" : "s"} ${tasks.groups.overdue.length === 1 ? "is" : "are"} overdue`;
  const summary = `${getCentralGreeting()}, Cody. Ava found ${tasks.groups.scheduled.length} scheduled Todoist item${tasks.groups.scheduled.length === 1 ? "" : "s"} for your calendar, ${tasks.groups.overdue.length} overdue, ${projects.active} active local project${projects.active === 1 ? "" : "s"}, and ${weather.condition.toLowerCase()} around ${weather.temperature}° in ${weather.location}.${completedClause}`;

  return {
    source: {
      tasks: tasks.source,
      completedTasks: completedTasks.source,
      weather: weather.source,
      projects: projects.source,
      automations: "supabase-n8n",
    },
    summary,
    scheduleOverview: `Todoist is the schedule source. ${tasks.groups.today.length} scheduled items are due today and ${tasks.groups.upcoming.length} are upcoming.`,
    taskPriorities: `${tasks.groups.highPriority.filter((task) => task.hasSchedule).length} scheduled high-priority items are active. ${overdueLabel}. ${completedTasks.completedSummary}`,
    weatherImpact: `${weather.condition}, high ${weather.high}°, low ${weather.low}°, rain chance ${weather.rainChance}%. ${weather.recommendation}`,
    businessPulse: `${projects.count} local projects are registered in Ava. ${projects.active} are active, ready, or prototyped.`,
    automationIssues: automationSnapshot.latestFailure,
    suggestedFocus: tasks.groups.overdue.length
      ? "Clear the overdue Todoist queue first, then move into project work."
      : "Use the first focused block for project work, then review automations.",
    personalNotes: "Todoist, weather, local projects, n8n automation status, and connection inventory are now live in Ava local preview.",
  };
}
