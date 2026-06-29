import { callToolHub, extractTodoistTasks, type TodoistTask } from "@/lib/jarvis/tool-hub";
import { tasks as mockTasks } from "@/lib/mock-data/ava";

export type AvaTask = {
  id: string;
  title: string;
  dueDate: string;
  scheduledFor: string | null;
  hasSchedule: boolean;
  priority: number;
  project: string;
  status: "overdue" | "due_today" | "upcoming" | "unscheduled" | "completed";
  source: "Todoist" | "Mock";
  url?: string;
};

function todayLocalDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysLocalDate(date: string, days: number) {
  const nextDate = new Date(`${date}T12:00:00-05:00`);
  nextDate.setDate(nextDate.getDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextDate);
}

function mapTodoistTask(task: TodoistTask): AvaTask {
  const scheduledFor = task.due?.datetime || task.due?.date || task.due?.string || null;
  const dueDate = scheduledFor || "No schedule";
  const today = todayLocalDate();
  const dueDay = task.due?.date || task.due?.datetime?.slice(0, 10);
  const status = !dueDay ? "unscheduled" : dueDay < today ? "overdue" : dueDay > today ? "upcoming" : "due_today";
  return {
    id: task.id || crypto.randomUUID(),
    title: task.content || "Untitled Todoist task",
    dueDate,
    scheduledFor,
    hasSchedule: Boolean(dueDay),
    priority: task.priority ?? 4,
    project: "Todoist",
    status,
    source: "Todoist",
    url: task.url,
  };
}

function mockAsAvaTasks(): AvaTask[] {
  return mockTasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueDate,
    scheduledFor: task.dueDate === "No schedule" ? null : task.dueDate,
    hasSchedule: task.dueDate !== "No schedule",
    priority: task.priority,
    project: task.project,
    status: task.status as AvaTask["status"],
    source: "Mock",
  }));
}

export function groupAvaTasks(tasks: AvaTask[]) {
  const today = todayLocalDate();
  const nextThreeDaysEnd = addDaysLocalDate(today, 3);

  return {
    overdue: tasks.filter((task) => task.status === "overdue"),
    today: tasks.filter((task) => task.status === "due_today"),
    upcoming: tasks.filter((task) => task.status === "upcoming"),
    nextThreeDays: tasks.filter((task) => {
      const dueDay = task.scheduledFor?.slice(0, 10);

      return Boolean(task.hasSchedule && dueDay && dueDay > today && dueDay <= nextThreeDaysEnd);
    }),
    scheduled: tasks.filter((task) => task.hasSchedule),
    unscheduled: tasks.filter((task) => !task.hasSchedule && task.status !== "completed"),
    highPriority: tasks.filter((task) => task.priority <= 2 && task.status !== "completed"),
    completedToday: tasks.filter((task) => task.status === "completed"),
  };
}

async function readTodoistTasks(filter: string) {
  const response = await callToolHub<TodoistTask[]>({
    tool: "todoist.list",
    parameters: { filter },
    user: "cody",
    timeoutMs: 4500,
  });
  const todoistTasks = response.success ? extractTodoistTasks(response.data) : null;
  return { response, todoistTasks };
}

function uniqueTasks(tasks: AvaTask[]) {
  return Array.from(new Map(tasks.map((task) => [task.id, task])).values());
}

export async function getAvaTasks(filter?: string) {
  const reads = filter
    ? [await readTodoistTasks(filter)]
    : await Promise.all([
      readTodoistTasks("today | overdue | 7 days"),
      readTodoistTasks("no date"),
    ]);
  const todoistTasks = reads.flatMap((read) => read.todoistTasks || []);
  const failedRead = reads.find((read) => !read.todoistTasks);
  const tasks = todoistTasks.length ? uniqueTasks(todoistTasks.map(mapTodoistTask)) : mockAsAvaTasks();
  return {
    source: todoistTasks.length ? "live-todoist" : "mock",
    error: todoistTasks.length ? null : failedRead?.response.error || "Unexpected Todoist response format",
    tasks,
    groups: groupAvaTasks(tasks),
  };
}

export async function getAvaSchedule() {
  const data = await getAvaTasks("today | overdue | 7 days");
  const today = todayLocalDate();
  const scheduledItems = data.tasks.filter((task) => task.hasSchedule);
  const todayItems = scheduledItems.filter((task) => task.status !== "upcoming");
  const upcomingItems = scheduledItems.filter((task) => task.status === "upcoming");
  return {
    source: data.source,
    error: data.error,
    today,
    scheduledItems,
    todayItems,
    upcomingItems,
  };
}
