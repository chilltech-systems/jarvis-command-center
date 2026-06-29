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

  const completedClause = completedTasks.completedCount > 0 ? ` I also saw ${completedTasks.completedCount} Todoist task${completedTasks.completedCount === 1 ? "" : "s"} already completed today.` : "";
  const overdueLabel = `${tasks.groups.overdue.length} item${tasks.groups.overdue.length === 1 ? "" : "s"} ${tasks.groups.overdue.length === 1 ? "is" : "are"} overdue`;
  const summary = `${getCentralGreeting()}, Cody. I found ${tasks.groups.scheduled.length} scheduled Todoist item${tasks.groups.scheduled.length === 1 ? "" : "s"} on your calendar, ${tasks.groups.overdue.length} overdue, ${projects.active} active local project${projects.active === 1 ? "" : "s"}, and ${weather.condition.toLowerCase()} around ${weather.temperature}° in ${weather.location}.${completedClause}`;

  return {
    source: {
      tasks: tasks.source,
      completedTasks: completedTasks.source,
      weather: weather.source,
      projects: projects.source,
      automations: "supabase-n8n",
    },
    summary,
    scheduleOverview: `I am using Todoist as the schedule source. I found ${tasks.groups.today.length} scheduled item${tasks.groups.today.length === 1 ? "" : "s"} due today and ${tasks.groups.upcoming.length} coming up after that.`,
    taskPriorities: `I am watching ${tasks.groups.highPriority.filter((task) => task.hasSchedule).length} scheduled high-priority item${tasks.groups.highPriority.filter((task) => task.hasSchedule).length === 1 ? "" : "s"}. ${overdueLabel}. ${completedTasks.completedSummary}`,
    weatherImpact: `I am tracking ${weather.condition.toLowerCase()} today: high ${weather.high}°, low ${weather.low}°, rain chance ${weather.rainChance}%. ${weather.recommendation}`,
    businessPulse: `I found ${projects.count} local project records. ${projects.active} are active, ready, or prototyped, so I am keeping those closest to the surface.`,
    automationIssues: `I am keeping an eye on this automation note: ${automationSnapshot.latestFailure}`,
    suggestedFocus: tasks.groups.overdue.length
      ? "I would clear the overdue Todoist queue first, then move into project work."
      : "I would use the first focused block for project work, then do an automation pass.",
    personalNotes: "I have Todoist, weather, local projects, n8n automation status, and connection inventory running in the local preview.",
  };
}
