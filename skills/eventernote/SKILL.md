---
name: eventernote
description: Use when the user wants to query Eventernote actor, event, or place information with the `eventernote` CLI.
---

# Eventernote

Use the `eventernote` CLI as the source of truth for Eventernote data.

## Workflow

1. Check that the command exists:

```sh
command -v eventernote
eventernote --help
```

2. If the command is missing, run the requested query with `npx eventernote ...` instead. If `npx eventernote` also fails, stop and ask the user how they want to proceed.

3. Choose the closest read-only query command for the user's request.

4. Prefer `--json` for agent use. Parse the JSON and summarize the relevant fields for the user. Do not expose raw JSON unless the user asks for it.

5. Use `--page <page>` when the user asks for a later page or when more results are needed.

6. If a query is ambiguous, run a list/search command first and ask the user to choose from candidates unless the result is obvious.

## Commands

```sh
eventernote actor list [keyword] [--popular] [--new] [--page <page>] [--json]
eventernote actor get <id,name> [--json]

eventernote event list [keyword] [--date YYYY-MM-DD] [--region <region>] [--prefecture <prefecture>] [--actor <actor>] [--place <place>] [--page <page>] [--json]
eventernote event get <id,name> [--json]

eventernote place list [keyword] [--prefecture <prefecture>] [--page <page>] [--json]
eventernote place get <id,name> [--json]
```

Read `references/usage.md` when choosing a command or interpreting JSON output.
