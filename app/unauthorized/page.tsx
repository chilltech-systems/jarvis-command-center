import { AccountControls } from "@/app/components/account-controls";

export default function UnauthorizedPage() {
  return <main className="login-wrap"><section className="login-card"><div className="eyebrow">Access denied</div><h1>Identity Not Authorized</h1><p className="subtle">This Google account is authenticated but is not on the Ava administrator allowlist.</p><AccountControls /></section></main>;
}
