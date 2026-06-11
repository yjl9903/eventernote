# eventernote

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/yjl9903/eventernote)
[![version](https://img.shields.io/npm/v/eventernote?label=eventernote)](https://www.npmjs.com/package/eventernote)
[![CI](https://github.com/yjl9903/eventernote/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/eventernote/actions/workflows/ci.yml)

[Eventernote](https://www.eventernote.com) CLI and TypeScript library, used for querying Eventernote actor, event, or place information.

## Skill

Copy this to your agent:

```text
Install the eventernote skill from https://github.com/yjl9903/eventernote/blob/main/skills/eventernote/
```

## Installation

```bash
npm i -g eventernote

eventernote --version
```

## Usage

Run queries from the CLI.

```bash
# Actor queries
eventernote actor list 前橋ウィッチーズ
eventernote actor list --popular
eventernote actor list --new --page 2
eventernote actor get 前橋ウィッチーズ

# Event queries
eventernote event list 前橋ウィッチーズ --date 2026-09-27 --region 関東 --prefecture 群馬県
eventernote event list --actor 前橋ウィッチーズ --page 2
eventernote event list --place 昌賢学園まえばしホール
eventernote event get 479641

# Place queries
eventernote place list 前橋
eventernote place list --prefecture 群馬県
eventernote place get 昌賢学園まえばしホール
```

Use the client API from TypeScript.

```ts
import { EventernoteClient } from 'eventernote';

const client = new EventernoteClient();

const actors = await client.searchActors({ keyword: '前橋ウィッチーズ', page: 1 });
const popularActors = await client.listPopularActors();
const newActors = await client.listNewActors({ page: 2 });
const actor = await client.getActor('前橋ウィッチーズ');
console.log(actors, popularActors, newActors, actor);

const eventsBySearch = await client.listEvents({
  keyword: '前橋ウィッチーズ',
  date: '2026-09-27',
  region: '関東',
  prefecture: '群馬県'
});
const eventsByActor = await client.listEvents({ actor: '前橋ウィッチーズ', page: 2 });
const eventsByPlace = await client.listEvents({ place: '昌賢学園まえばしホール' });
const event = await client.getEvent('479641');
console.log(eventsBySearch, eventsByActor, eventsByPlace, event);

const placesByKeyword = await client.searchPlaces({ keyword: '前橋', page: 1 });
const placesByPrefecture = await client.searchPlaces({ prefecture: '群馬県' });
const place = await client.getPlace('昌賢学園まえばしホール');
console.log(placesByKeyword, placesByPrefecture, place);

const search = await client.verticalSearch('前橋ウィッチーズ');
console.log(search);
```

## License

MIT License © 2026 [OneKuma](https://github.com/yjl9903)
