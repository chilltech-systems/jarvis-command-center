export type CodexPromptPackage = {
  title: string;
  objective: string;
  workspace: string;
  prompt: string;
};

const DEFAULT_WORKSPACE = "/Users/c.hill/Documents/Projects";

function cleanCodexRequest(message: string) {
  return message
    .trim()
    .replace(/^(jarvis[, ]*)?/i, "")
    .replace(/^(please\s+)?(can you|could you|would you)\s+/i, "")
    .replace(/^(create|draft|make|prepare|run|send)\s+(a\s+)?(codex\s+)?(prompt|task|request)\s*(for|to)?\s*/i, "")
    .replace(/^codex[:,\s-]*/i, "")
    .trim();
}

function titleFromObjective(objective: string) {
  const words = objective.replace(/[^\w\s-]/g, "").split(/\s+/).filter(Boolean).slice(0, 8);
  return words.length ? words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") : "Codex Task";
}

export function createCodexPromptPackage(message: string): CodexPromptPackage | null {
  const objective = cleanCodexRequest(message);
  if (!objective) return null;

  const title = titleFromObjective(objective);
  const prompt = [
    "PLEASE IMPLEMENT THIS TASK:",
    "",
    `# ${title}`,
    "",
    "## Objective",
    objective,
    "",
    "## Workspace",
    DEFAULT_WORKSPACE,
    "",
    "## Instructions",
    "- Inspect the real workspace before editing.",
    "- Preserve existing production contracts and secrets.",
    "- Keep changes scoped to the requested behavior.",
    "- Run relevant validation and report what passed or could not be run.",
    "- Summarize changed files and any follow-up needed.",
  ].join("\n");

  return {
    title,
    objective,
    workspace: DEFAULT_WORKSPACE,
    prompt,
  };
}

export function formatCodexPromptPackage(pkg: CodexPromptPackage) {
  return [
    "Codex prompt package prepared. I cannot execute the desktop Codex app directly from Vercel yet, but this is ready to run in Codex:",
    "",
    "```text",
    pkg.prompt,
    "```",
  ].join("\n");
}

export function codexApprovalTarget(pkg: CodexPromptPackage) {
  return `${pkg.title} (${pkg.workspace})`;
}
