# Jarvis Tool Hub Parser Routing Edge Cases

## Scope

The current Jarvis assistant routes messages through two deterministic parser
layers:

- `findToolForMessage` in `lib/jarvis/tool-registry.ts` chooses the tool.
- `parseTodoistCreateRequest` in `lib/jarvis/tool-hub.ts` extracts Todoist
  creation parameters before the approval record is created.

These tests should protect routing intent without calling the live Tool Hub or
changing the `POST /jarvis-tools` contract.

## Suggested Edge-case Tests

### Todoist create routing

- `Jarvis, add task follow up with Drew tomorrow` should route to
  `todoist.create`, not `todoist.list`.
- `please can you create a Todoist task to review the catering report due today`
  should route to `todoist.create` and extract task
  `review the catering report` with due `today`.
- `put order paper goods in my todo list` should route to `todoist.create`.
- `remind me to send payroll notes on friday` should route to `todoist.create`
  and extract due `friday`.
- `add a task` should not create an approval with an empty target.

### Todoist list routing

- `what are my tasks today` should route to `todoist.list`.
- `what do I need to do today` should route to `todoist.list`.
- `show todoist overdue tasks` should route to `todoist.list`.

### Todoist complete routing

- `complete the Todoist task for payroll notes` should route to
  `todoist.complete`.
- `mark the catering follow-up task done` should route to `todoist.complete`.
- Completion requests should not fall through to `todoist.list` just because
  they contain `task`.

### Route priority conflicts

- `create a Codex task to add Todoist sync` should route to `create_codex_task`,
  not `todoist.create`, if Codex task routing is intended to own prompts that
  explicitly ask Codex to build something.
- `what failed workflows need my attention` should route to `get_n8n_status`.
- `draft a Slack message about today's Todoist tasks` should route to
  `send_slack_message` if the user intent is outbound Slack, not Todoist list.
- `email me my task list` should route to email drafting or credential-needed
  email behavior if outbound communication is the explicit action.

### Parser extraction details

- Strip leading assistant address forms such as `Jarvis,`, `please`, and
  `could you`.
- Preserve meaningful task text after removing command words.
- Extract supported due phrases only when they are scheduling metadata:
  `today`, `tomorrow`, `next week`, and weekdays.
- Do not strip business words that happen to follow `on`, `for`, or `due` unless
  they match the supported due vocabulary.
- Preserve case-insensitive matching while returning a clean task target for the
  approval screen.

### Tool Hub response formatting

- Empty Todoist results should return the connected-but-empty message.
- More than eight Todoist tasks should show the first eight and include the
  remaining count.
- Tool Hub responses shaped as `{ results: [...] }`, `{ tasks: [...] }`, or a
  raw array should all extract successfully.
- Non-array or missing task payloads should produce the explicit unexpected
  response message instead of claiming success.

## Follow-up Implementation Note

The repo does not currently have a unit-test runner. A future test pass can add
a tiny TypeScript test harness for `findToolForMessage`,
`parseTodoistCreateRequest`, `extractTodoistTasks`, and the Todoist formatter
without hitting Supabase, OpenAI, n8n, or the live Tool Hub.
