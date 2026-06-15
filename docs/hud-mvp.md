# Jarvis HUD MVP

## Live Components

- Private Next.js HUD with Supabase Google OAuth authentication
- Admin allowlist: `chilltechsolutions.net@gmail.com`
- Supabase-backed overview, activity stream, workflow health, issues, and workflow details
- Active five-minute n8n execution collector
- Active Command Center dual-write to Google Sheets and Supabase
- Additive continue-on-fail business pulses in live Brenham and IDAD Automations

## Pulse Coverage

| System | Signals |
|---|---|
| Brenham Catering Receipt OCR | Receipt heartbeat, completion, unmatched-item manual review |
| Brenham Checklist Completion | Processed checklist completion |
| IDAD Texas Hourlys | Hourly import completion |
| IDAD Taco John's Metrics | Daily metrics completion |
| IDAD Product Mix - TJ | Report generation and delivery |

Master exports remain unchanged. Inactive monitored variants live in each
system's `n8n/monitored/` folder.

## Authentication

The HUD uses the Supabase publishable key in the browser. All base tables have
RLS enabled, all HUD views use invoker security, and only allowlisted
authenticated emails can read monitoring data. The service-role secret is used
only by encrypted n8n credentials.

Google OAuth uses the existing CHILL TECH Google Cloud project:

- Authorized JavaScript origin:
  `https://jarvis-command-center-phi.vercel.app`
- Authorized redirect URI:
  `https://gkimbjzayddxlbyiwoqb.supabase.co/auth/v1/callback`
- Supabase redirect URL:
  `https://jarvis-command-center-phi.vercel.app/auth/callback`
- Required Google scopes: `openid`, email, and profile only

The Google OAuth client secret belongs only in the Supabase Google provider
configuration. Never place it in this repository or Vercel.

Each browser and device creates its own Supabase session. Use **Switch account**
to sign out and force Google's account chooser, or **Sign out** to end the local
device session. An authenticated account that is not on the Jarvis allowlist is
sent to `/unauthorized` and cannot read HUD data.

If Google sign-in fails, the callback sends the provider or code-exchange error
back to `/login` for display. Verify the three URLs above before changing code.

## Timezone

Supabase stores execution and event timestamps as timezone-aware UTC values.
The HUD converts every visible automation timestamp to `America/Chicago`,
including the correct `CST` or `CDT` abbreviation based on daylight saving
time. n8n schedules should also use the `America/Chicago` workflow timezone.

## Local Development

```bash
npm install
npm run dev
```

Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.example`.
