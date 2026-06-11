# Eventernote CLI Usage

Use this reference when choosing commands or interpreting `--json` output.

## Command Selection

- Search actors: `eventernote actor list <keyword> --json`
- Popular actors: `eventernote actor list --popular --json`
- New actors: `eventernote actor list --new --json`
- Actor details: `eventernote actor get <id-or-name> --json`
- Search events: `eventernote event list <keyword> --json`
- Events on a date: `eventernote event list --date YYYY-MM-DD --json`
- Events by actor: `eventernote event list --actor <id-or-name> --json`
- Events by place: `eventernote event list --place <id-or-name> --json`
- Event details: `eventernote event get <id-or-name> --json`
- Search places: `eventernote place list <keyword> --json`
- Places by prefecture: `eventernote place list --prefecture <id-or-name> --json`
- Place details: `eventernote place get <id-or-name> --json`

Add `--page <page>` for paginated list results.

## JSON Results

Successful JSON output:

```json
{
  "ok": true,
  "data": []
}
```

Failed JSON output:

```json
{
  "ok": false,
  "code": "invalid_argument",
  "message": "error message"
}
```

`ambiguous_result` errors may include `candidates`, each with `id`, `name`, and `url`.

## Useful Fields

Actor summaries include `id`, `name`, `kana`, `favorite_count`, `rank`, `source`, and `url`.

Event summaries include `id`, `name`, `date`, `open_time`, `start_time`, `end_time`, `place`, `actors`, `note_count`, `url`, and `is_past`.

Place summaries include `id`, `name`, `prefecture_id`, `address`, `capacity`, `web_url`, `seat_url`, `latitude`, `longitude`, and `url`.

Detail commands return one top-level object:

- `actor get`: `actor`, `fan_count`, `event_count`, `all_events_url`, `recent_events`
- `event get`: `event`, `links`, `hashtag`, `description`, `participants_count`
- `place get`: `place`, `map_url`, `event_count`, `events`

## Answering

- Summarize the requested facts, not the command mechanics.
- Include ids or URLs when they help the user disambiguate.
- If `ok` is false, report the `message`; for `ambiguous_result`, show the candidate names and ids.
