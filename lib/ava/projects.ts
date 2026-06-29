import fs from "node:fs";
import path from "node:path";
import { projects as mockProjects } from "@/lib/mock-data/ava";

const PROJECT_ROOT = "/Users/c.hill/Documents/Projects";

const PROJECT_PATHS: Record<string, string> = {
  "Ava": "jarvis-command-center",
  "CHILL TECH Website": "CHILL TECH",
  "MarketBrief": "MarketBrief",
  "Missed Call Text Back": "missed-call-text-back",
  "Globe Watch": "jarvis-globe-watch-update",
  "Baby BP Tracker": "CHILL TECH/HealthTrack",
  "Client Portal Generator": "learning",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(date);
}

function packageName(projectPath: string) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectPath, "package.json"), "utf8")) as { name?: string };
    return packageJson.name;
  } catch {
    return null;
  }
}

export function getAvaProjects() {
  return mockProjects.map((project) => {
    const relativePath = PROJECT_PATHS[project.name];
    const absolutePath = relativePath ? path.join(PROJECT_ROOT, relativePath) : "";
    const exists = Boolean(absolutePath && fs.existsSync(absolutePath));
    const stat = exists ? fs.statSync(absolutePath) : null;
    const hasGit = exists && fs.existsSync(path.join(absolutePath, ".git"));
    const packageLabel = exists ? packageName(absolutePath) : null;
    return {
      ...project,
      source: exists ? "local-workspace" : "planned",
      workspacePath: exists ? absolutePath : null,
      status: exists ? project.status : "Planned",
      lastUpdated: stat ? formatDate(stat.mtime) : project.lastUpdated,
      relatedSystems: [
        ...project.relatedSystems,
        ...(hasGit ? ["Git"] : []),
        ...(packageLabel ? ["Node app"] : []),
      ],
      link: exists ? `file://${absolutePath}` : project.link,
    };
  });
}

export function getProjectSummary() {
  const projects = getAvaProjects();
  return {
    source: "local-workspace",
    count: projects.length,
    active: projects.filter((project) => ["Active", "Ready", "Prototype"].includes(project.status)).length,
    projects,
  };
}
