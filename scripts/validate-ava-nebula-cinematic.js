const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

function snapshot(missionStatus, severity = "normal") {
  return {
    schemaVersion: 2,
    generatedAt: new Date(0).toISOString(),
    sourceMode: "live",
    missionStatus,
    runtimeHealth: { status: missionStatus === "Critical" ? "error" : missionStatus === "Calm" ? "healthy" : "warning", summary: "Fixture", liveSources: 4, unavailableSources: 0 },
    currentFocus: { regionId: "reasoning", summary: "Fixture focus" },
    regions: [{ id: "reasoning", displayName: "Reasoning", description: "Fixture", center: [0, 0, 0], activity: 0.8, status: "active", eventCount: 1, latestEvent: null, relatedRegionIds: ["attention"], interpretation: "Fixture" }],
    recentEvents: [{ id: "fixture", type: "system.System", regionId: "reasoning", summary: "Fixture", timestamp: new Date(0).toISOString(), severity, source: "system", presentation: { intensity: 0.8, tone: severity === "critical" ? "critical" : "focus", shockwave: severity === "critical", path: ["awareness", "attention", "reasoning"] } }],
    notableMemories: [],
  };
}

async function main() {
  const visualModule = await import(pathToFileURL(path.join(root, "lib/ava/nebula-visual-state.ts")));
  const home = visualModule.buildNebulaVisualState({ snapshot: snapshot("Calm") });
  const expanded = { viewMode: "cognition", viewTransitionProgress: 1 };
  const calm = visualModule.buildNebulaVisualState({ snapshot: snapshot("Calm"), ...expanded });
  const focused = visualModule.buildNebulaVisualState({ snapshot: snapshot("Focused"), ...expanded });
  const busy = visualModule.buildNebulaVisualState({ snapshot: snapshot("Busy", "high"), ...expanded });
  const critical = visualModule.buildNebulaVisualState({ snapshot: snapshot("Critical", "critical"), ...expanded });
  const listening = visualModule.buildNebulaVisualState({ snapshot: snapshot("Calm"), voiceMode: "listening", voiceEnergy: 0.8, ...expanded });
  const memory = visualModule.buildNebulaVisualState({ snapshot: snapshot("Calm"), memoryMode: true, ...expanded });

  assert.equal(calm.healthTone, "calm");
  assert.equal(focused.healthTone, "focus");
  assert.equal(busy.healthTone, "warning");
  assert.equal(critical.healthTone, "critical");
  assert.equal(home.viewMode, "home");
  assert.equal(home.viewTransitionProgress, 0);
  assert.ok(calm.globalIntensity > home.globalIntensity, "The compact home must remain calmer than cognition.");
  assert.equal(home.focusedRegionId, null, "Home must not preselect a cognition region.");
  assert.equal(calm.focusedRegionId, "reasoning", "Cognition should open on the live focus region.");
  assert.ok(critical.globalIntensity > calm.globalIntensity, "Critical state should be more intense than calm.");
  assert.ok(listening.breathing > calm.breathing, "Listening energy should visibly affect breathing.");
  assert.ok(memory.fogDensity > calm.fogDensity, "Recall mode should visibly dim the current field.");

  const externalRoute = fs.readFileSync(path.join(root, "app/api/ava/nebula-feed/route.ts"), "utf8");
  const realtimeRoute = fs.readFileSync(path.join(root, "app/api/ava/realtime/route.ts"), "utf8");
  assert.match(externalRoute, /AVA_NEBULA_FEED_TOKEN/, "External bearer feed contract must remain intact.");
  assert.match(realtimeRoute, /requireJarvisAdmin/, "Realtime route must require Jarvis admin authentication.");
  assert.doesNotMatch(realtimeRoute, /return.*OPENAI_API_KEY/, "Realtime route must never return the OpenAI API key.");

  console.log("AVA_NEBULA_CINEMATIC_OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
