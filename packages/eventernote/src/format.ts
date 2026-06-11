import { toEventernoteError } from './client/errors.js';
import type {
  ActorDetail,
  ActorSummary,
  EventDetail,
  EventSummary,
  JsonFail,
  JsonOk,
  PlaceDetail,
  PlaceSummary
} from './client/types.js';

export type OutputMode = 'json' | 'tty' | 'csv';
export type Resource = 'actor' | 'event' | 'place';

export function jsonOk<T>(data: T): string {
  return `${JSON.stringify({ ok: true, data } satisfies JsonOk<T>, null, 2)}\n`;
}

export function jsonFail(error: unknown): string {
  const eventernoteError = toEventernoteError(error);
  const payload: JsonFail = {
    ok: false,
    code: eventernoteError.code,
    message: eventernoteError.message
  };
  if (eventernoteError.candidates) {
    payload.candidates = eventernoteError.candidates;
  }
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function formatList(
  resource: Resource,
  data: ActorSummary[] | EventSummary[] | PlaceSummary[],
  mode: OutputMode
): string {
  if (mode === 'json') return jsonOk(data);
  if (resource === 'actor') return formatActorList(data as ActorSummary[], mode);
  if (resource === 'event') return formatEventList(data as EventSummary[], mode);
  return formatPlaceList(data as PlaceSummary[], mode);
}

export function formatDetail(
  resource: Resource,
  data: ActorDetail | EventDetail | PlaceDetail,
  mode: OutputMode
): string {
  if (mode === 'json') return jsonOk(data);
  if (resource === 'actor') return formatActorDetail(data as ActorDetail, mode);
  if (resource === 'event') return formatEventDetail(data as EventDetail, mode);
  return formatPlaceDetail(data as PlaceDetail, mode);
}

function formatActorList(data: ActorSummary[], mode: OutputMode): string {
  const rows = data.map((actor) => ({
    id: String(actor.id),
    name: actor.name,
    kana: actor.kana ?? '',
    fav: actor.favorite_count === null ? '' : String(actor.favorite_count),
    source: actor.rank ? `${actor.rank}/${actor.source}` : actor.source
  }));
  if (mode === 'csv') {
    return csv(
      ['id', 'name', 'kana', 'initial', 'favorite_count', 'image_url', 'url', 'rank', 'source'],
      data.map((actor) => [
        actor.id,
        actor.name,
        actor.kana,
        actor.initial,
        actor.favorite_count,
        actor.image_url,
        actor.url,
        actor.rank,
        actor.source
      ])
    );
  }
  return table(['ID', 'NAME', 'KANA', 'FAV', 'RANK/SOURCE'], rows.map(Object.values));
}

function formatPlaceList(data: PlaceSummary[], mode: OutputMode): string {
  if (mode === 'csv') {
    return csv(
      [
        'id',
        'name',
        'prefecture_id',
        'address',
        'postal_code',
        'tel',
        'capacity',
        'web_url',
        'seat_url',
        'latitude',
        'longitude',
        'url'
      ],
      data.map((place) => [
        place.id,
        place.name,
        place.prefecture_id,
        place.address,
        place.postal_code,
        place.tel,
        place.capacity,
        place.web_url,
        place.seat_url,
        place.latitude,
        place.longitude,
        place.url
      ])
    );
  }
  return table(
    ['ID', 'NAME', 'PREF', 'CAPACITY', 'ADDRESS'],
    data.map((place) => [
      String(place.id),
      place.name,
      nullable(place.prefecture_id),
      place.capacity ?? '',
      place.address ?? ''
    ])
  );
}

function formatEventList(data: EventSummary[], mode: OutputMode): string {
  if (mode === 'csv') {
    return csv(
      [
        'id',
        'name',
        'date',
        'weekday',
        'open_time',
        'start_time',
        'end_time',
        'place_id',
        'place_name',
        'actors',
        'note_count',
        'image_url',
        'url',
        'is_past'
      ],
      data.map((event) => [
        event.id,
        event.name,
        event.date,
        event.weekday,
        event.open_time,
        event.start_time,
        event.end_time,
        event.place?.id ?? null,
        event.place?.name ?? null,
        event.actors.map((actor) => actor.name).join('; '),
        event.note_count,
        event.image_url,
        event.url,
        event.is_past
      ])
    );
  }
  return table(
    ['ID', 'DATE', 'TIME', 'NAME', 'PLACE', 'ACTORS', 'NOTES'],
    data.map((event) => [
      String(event.id),
      event.date ?? '',
      timeRange(event),
      event.name,
      event.place?.name ?? '',
      event.actors.map((actor) => actor.name).join(', '),
      nullable(event.note_count)
    ])
  );
}

function formatActorDetail(data: ActorDetail, mode: OutputMode): string {
  if (mode === 'csv') {
    return csvRow([
      data.actor.id,
      data.actor.name,
      data.actor.kana,
      data.fan_count,
      data.event_count,
      data.all_events_url,
      data.actor.url
    ]);
  }
  return [
    `Actor: ${data.actor.name} (${data.actor.id})`,
    data.actor.kana ? `Kana: ${data.actor.kana}` : null,
    `Fans: ${nullable(data.fan_count)}`,
    `Events: ${nullable(data.event_count)}`,
    data.all_events_url ? `All events: ${data.all_events_url}` : null,
    `URL: ${data.actor.url}`,
    data.recent_events.length > 0 ? '' : null,
    data.recent_events.length > 0 ? 'Recent events:' : null,
    ...data.recent_events.slice(0, 10).map((event) => `  ${event.date ?? '-'} ${event.name}`)
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
    .concat('\n');
}

function formatPlaceDetail(data: PlaceDetail, mode: OutputMode): string {
  if (mode === 'csv') {
    return csvRow([
      data.place.id,
      data.place.name,
      data.place.prefecture_id,
      data.place.address,
      data.place.postal_code,
      data.place.tel,
      data.place.capacity,
      data.place.web_url,
      data.place.seat_url,
      data.map_url,
      data.event_count,
      data.place.url
    ]);
  }
  return [
    `Place: ${data.place.name} (${data.place.id})`,
    `Prefecture: ${nullable(data.place.prefecture_id)}`,
    data.place.address ? `Address: ${data.place.address}` : null,
    data.place.tel ? `Tel: ${data.place.tel}` : null,
    data.place.capacity ? `Capacity: ${data.place.capacity}` : null,
    data.place.web_url ? `Website: ${data.place.web_url}` : null,
    data.place.seat_url ? `Seat: ${data.place.seat_url}` : null,
    data.map_url ? `Map: ${data.map_url}` : null,
    `Events: ${nullable(data.event_count)}`,
    `URL: ${data.place.url}`,
    data.events.length > 0 ? '' : null,
    data.events.length > 0 ? 'Events:' : null,
    ...data.events.slice(0, 10).map((event) => `  ${event.date ?? '-'} ${event.name}`)
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
    .concat('\n');
}

function formatEventDetail(data: EventDetail, mode: OutputMode): string {
  if (mode === 'csv') {
    return csvRow([
      data.event.id,
      data.event.name,
      data.event.date,
      data.event.weekday,
      data.event.open_time,
      data.event.start_time,
      data.event.end_time,
      data.event.place?.id ?? null,
      data.event.place?.name ?? null,
      data.event.actors.map((actor) => actor.name).join('; '),
      data.event.note_count,
      data.links.join('; '),
      data.hashtag,
      data.participants_count,
      data.event.url
    ]);
  }
  return [
    `Event: ${data.event.name} (${data.event.id})`,
    `Date: ${data.event.date ?? '-'}${data.event.weekday ? ` (${data.event.weekday})` : ''}`,
    `Time: ${timeRange(data.event) || '-'}`,
    data.event.place ? `Place: ${data.event.place.name}` : null,
    `Actors: ${formatActors(data.event.actors.map((actor) => actor.name))}`,
    `Participants: ${nullable(data.participants_count)}`,
    data.hashtag ? `Hashtag: ${data.hashtag}` : null,
    data.links.length > 0 ? `Links: ${data.links.join(', ')}` : null,
    `URL: ${data.event.url}`
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
    .concat('\n');
}

function table(headers: string[], rows: string[][]): string {
  const visibleRows = rows.map((row) => row.map((cell) => truncate(cell)));
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...visibleRows.map((row) => displayWidth(row[index] ?? '')))
  );
  const renderRow = (row: string[]) =>
    row
      .map((cell, index) => padRight(cell, widths[index]))
      .join('  ')
      .trimEnd();
  return [
    renderRow(headers),
    renderRow(headers.map((header) => '-'.repeat(header.length))),
    ...visibleRows.map(renderRow)
  ]
    .join('\n')
    .concat('\n');
}

function csv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
    .concat('\n');
}

function csvRow(row: unknown[]): string {
  return row.map(csvCell).join(',').concat('\n');
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\r\n]/u.test(text)) return text;
  return `"${text.replace(/"/gu, '""')}"`;
}

function timeRange(event: EventSummary): string {
  return [
    event.open_time ? `open ${event.open_time}` : null,
    event.start_time ? `start ${event.start_time}` : null,
    event.end_time ? `end ${event.end_time}` : null
  ]
    .filter(Boolean)
    .join(' ');
}

function formatActors(names: string[]): string {
  if (names.length <= 8) return names.join(', ');
  return `${names.slice(0, 8).join(', ')} +${names.length - 8} more`;
}

function nullable(value: number | string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function truncate(value: string): string {
  return displayWidth(value) > 32 ? `${value.slice(0, 29)}...` : value;
}

function padRight(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - displayWidth(value)));
}

function displayWidth(value: string): number {
  return Array.from(value).reduce((width, char) => width + (char.charCodeAt(0) > 255 ? 2 : 1), 0);
}
