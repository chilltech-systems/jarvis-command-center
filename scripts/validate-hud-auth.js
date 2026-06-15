const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const errors = [];

const login = read("app/login/page.tsx");
const callback = read("app/auth/callback/route.ts");
const controls = read("app/components/account-controls.tsx");
const proxy = read("proxy.ts");

for (const [label, content, required] of [
  ["login", login, ['provider: "google"', "signInWithOAuth", 'prompt: "select_account"']],
  ["callback", callback, ["exchangeCodeForSession", "error_description", 'new URL("/login"']],
  ["account controls", controls, ["signOut", "Switch account", "Sign out"]],
  ["proxy", proxy, ['supabase.rpc("is_jarvis_admin")', 'new URL("/unauthorized"']],
]) {
  for (const value of required) {
    if (!content.includes(value)) errors.push(`${label} is missing ${value}`);
  }
}

if (login.includes("signInWithOtp") || login.includes("SEND MAGIC LINK")) {
  errors.push("login page still contains magic-link authentication");
}

if (errors.length) {
  console.error("Jarvis HUD auth validation failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Jarvis HUD Google OAuth validation passed.");
