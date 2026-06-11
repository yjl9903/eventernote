import { JSDOM } from 'jsdom';

import { EventernoteError } from './errors.js';
import type {
  ActorDetail,
  ActorSource,
  ActorSummary,
  EntityLink,
  EventDetail,
  EventSummary,
  PlaceDetail,
  PlaceSummary
} from './types.js';

type RawActor = Record<string, unknown>;
type RawPlace = Record<string, unknown>;
type RawEvent = Record<string, unknown>;

export function parseDocument(html: string): Document {
  return new JSDOM(html).window.document;
}

export function parseCrumb(html: string): string {
  const document = parseDocument(html);
  const crumb = document.querySelector<HTMLMetaElement>('meta#crumb')?.content;
  if (!crumb) {
    throw new EventernoteError('parse_error', 'Failed to parse crumb');
  }
  return crumb;
}

export function actorFromApi(raw: RawActor, baseUrl: string): ActorSummary {
  const id = asNumber(raw.id);
  const name = asString(raw.name);
  if (id === null || !name) {
    throw new EventernoteError('parse_error', 'Invalid actor search result');
  }
  return {
    id,
    name,
    kana: asNullableString(raw.kana),
    initial: asNullableString(raw.initial),
    favorite_count: asNumber(raw.favorite_count),
    image_url: asNullableString(raw.image),
    url: absoluteUrl(`/actors/${id}`, baseUrl),
    rank: null,
    source: 'search'
  };
}

export function placeFromApi(raw: RawPlace, baseUrl: string): PlaceSummary {
  const id = asNumber(raw.id);
  const name = asString(raw.place_name);
  if (id === null || !name) {
    throw new EventernoteError('parse_error', 'Invalid place search result');
  }
  return {
    id,
    name,
    prefecture_id: asNumber(raw.prefecture),
    address: asNullableString(raw.address),
    postal_code: asNullableString(raw.postalcode),
    tel: asNullableString(raw.tel),
    capacity: asNullableString(raw.capacity),
    web_url: asNullableString(raw.web_url),
    seat_url: asNullableString(raw.seat_url),
    latitude: asNumber(raw.latitude),
    longitude: asNumber(raw.longitude),
    url: absoluteUrl(`/places/${id}`, baseUrl)
  };
}

export function eventFromApi(raw: RawEvent, baseUrl: string): EventSummary {
  const id = asNumber(raw.id);
  const name = asString(raw.event_name);
  if (id === null || !name) {
    throw new EventernoteError('parse_error', 'Invalid event search result');
  }
  const place = isRecord(raw.place) ? placeEntityFromApi(raw.place, baseUrl) : null;
  const actors = Array.isArray(raw.actors)
    ? raw.actors.filter(isRecord).map((actor) => actorEntityFromApi(actor, baseUrl))
    : [];
  return {
    id,
    name,
    date: asNullableString(raw.event_date),
    weekday: null,
    open_time: asNullableString(raw.open_time),
    start_time: asNullableString(raw.start_time),
    end_time: asNullableString(raw.end_time),
    place,
    actors,
    note_count: asNumber(raw.note_count),
    image_url: asNullableString(raw.thumb_url) ?? asNullableString(raw.image_url),
    url: absoluteUrl(`/events/${id}`, baseUrl),
    is_past: isPastDate(asNullableString(raw.event_date))
  };
}

export function parseActorHome(
  html: string,
  baseUrl: string,
  source: Extract<ActorSource, 'popular' | 'new'>
): ActorSummary[] {
  const document = parseDocument(html);
  const heading = source === 'popular' ? '人気の声優/アーティスト' : '新着声優/アーティスト';
  const links = linksAfterHeading(document, heading, '/actors/');
  return links.map((link, index) =>
    actorFromLink(link, baseUrl, source, source === 'popular' ? index + 1 : null)
  );
}

export function parseActorRanking(html: string, baseUrl: string): ActorSummary[] {
  const document = parseDocument(html);
  const page = document.querySelector('.span8.page') ?? document.body;
  const seen = new Set<number>();
  const actors: ActorSummary[] = [];
  for (const link of Array.from(page.querySelectorAll<HTMLAnchorElement>('a[href^="/actors/"]'))) {
    const actor = actorFromLink(link, baseUrl, 'popular', actors.length + 1);
    if (seen.has(actor.id)) continue;
    seen.add(actor.id);
    actors.push(actor);
  }
  return actors;
}

export function parseEventList(html: string, baseUrl: string): EventSummary[] {
  const document = parseDocument(html);
  return parseEventListDocument(document, baseUrl);
}

export function parseEventDetail(html: string, baseUrl: string, currentUrl: string): EventDetail {
  const document = parseDocument(html);
  const id = eventIdFromUrl(currentUrl);
  const title =
    text(document.querySelector('.gb_events_detail_title h2')) ||
    text(document.querySelector('h1')) ||
    document.title.replace(/\s+Eventernote.*$/u, '').trim();
  if (id === null || !title) {
    throw new EventernoteError('parse_error', 'Failed to parse event detail');
  }

  const rows = tableRows(document, '.gb_events_info_table table tr');
  const dateText = rows.get('開催日時') ?? null;
  const timeText = rows.get('時間') ?? '';
  const placeLink = rowElement(document, '開催場所')?.querySelector<HTMLAnchorElement>(
    'a[href^="/places/"]'
  );
  const actorLinks = Array.from(
    rowElement(document, '出演者')?.querySelectorAll<HTMLAnchorElement>('a[href^="/actors/"]') ?? []
  );
  const linkRow = rowElement(document, '関連リンク');
  const hashtagLink = rowElement(document, 'Twitterハッシュタグ')?.querySelector('a');
  const date = dateText?.match(/\d{4}-\d{2}-\d{2}/u)?.[0] ?? null;
  const weekday = dateText?.match(/\(([^)]+)\)/u)?.[1] ?? null;
  const imageUrl =
    document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? null;
  const summary: EventSummary = {
    id,
    name: title,
    date,
    weekday,
    ...parseTimes(timeText),
    place: placeLink ? entityFromLink(placeLink, baseUrl) : null,
    actors: actorLinks.map((link) => entityFromLink(link, baseUrl)),
    note_count: parseParticipantsCount(document),
    image_url: imageUrl,
    url: absoluteUrl(`/events/${id}`, baseUrl),
    is_past: isPastDate(date)
  };

  return {
    event: summary,
    links: linkRow
      ? Array.from(linkRow.querySelectorAll<HTMLAnchorElement>('a[href]')).map((link) =>
          absoluteUrl(link.href, baseUrl)
        )
      : [],
    hashtag: hashtagLink ? text(hashtagLink) : null,
    description: null,
    participants_count: summary.note_count
  };
}

export function parseActorDetail(html: string, baseUrl: string, currentUrl: string): ActorDetail {
  const document = parseDocument(html);
  const id = actorIdFromUrl(currentUrl) ?? numberFromText(html.match(/addFavorite\((\d+)\)/u)?.[1]);
  const title = text(document.querySelector('.gb_actors_title .name h2'));
  if (id === null || !title) {
    throw new EventernoteError('parse_error', 'Failed to parse actor detail');
  }
  const allEventsLink = document.querySelector<HTMLAnchorElement>('a[href$="/events"]');
  const eventCount = numberFromText(text(allEventsLink).match(/\((\d+)件\)/u)?.[1]);
  const fanCount = numberFromText(
    text(document.querySelector('h2 .number')) ||
      text(
        Array.from(document.querySelectorAll('h2')).find((h2) => text(h2).includes('ファン一覧'))
      )
  );
  const actor: ActorSummary = {
    id,
    name: title,
    kana: text(document.querySelector('.gb_actors_title .name h2.kana')) || null,
    initial: null,
    favorite_count: fanCount,
    image_url: null,
    url: absoluteUrl(`/actors/${id}`, baseUrl),
    rank: null,
    source: 'search'
  };
  return {
    actor,
    fan_count: fanCount,
    event_count: eventCount,
    all_events_url: allEventsLink ? absoluteUrl(allEventsLink.href, baseUrl) : null,
    recent_events: parseEventListDocument(document, baseUrl)
  };
}

export function parsePlaceDetail(html: string, baseUrl: string, currentUrl: string): PlaceDetail {
  const document = parseDocument(html);
  const id = placeIdFromUrl(currentUrl);
  const name = text(document.querySelector('.gb_place_detail_title h2'));
  if (id === null || !name) {
    throw new EventernoteError('parse_error', 'Failed to parse place detail');
  }
  const rows = tableRows(document, '.gb_place_detail_table table tr');
  const addressCell = rowElement(document, '所在地');
  const mapUrl =
    addressCell?.querySelector<HTMLAnchorElement>('a[href]')?.href ??
    document.querySelector<HTMLAnchorElement>('a[href^="http://maps.google.com/maps"]')?.href ??
    null;
  const place: PlaceSummary = {
    id,
    name,
    prefecture_id: prefectureIdFromBreadcrumb(document),
    address: stripPostalCode(rows.get('所在地') ?? null),
    postal_code: rows.get('所在地')?.match(/〒\d{3}-\d{4}/u)?.[0] ?? null,
    tel: rows.get('電話番号') ?? null,
    capacity: rows.get('収容人数') ?? null,
    web_url: hrefFromRow(document, '公式サイト', baseUrl),
    seat_url: hrefFromRow(document, '座席情報', baseUrl),
    ...parseLatLon(html),
    url: absoluteUrl(`/places/${id}`, baseUrl)
  };
  const allEventsLink = document.querySelector<HTMLAnchorElement>('a[href$="/events"]');
  return {
    place,
    map_url: mapUrl ? absoluteUrl(mapUrl, baseUrl) : null,
    event_count: numberFromText(text(allEventsLink).match(/\((\d+)件\)/u)?.[1]),
    events: parseEventListDocument(document, baseUrl)
  };
}

function parseEventListDocument(document: Document, baseUrl: string): EventSummary[] {
  const items = Array.from(document.querySelectorAll<HTMLLIElement>('.gb_event_list li.clearfix'));
  return items.flatMap((item) => {
    const eventLink = item.querySelector<HTMLAnchorElement>('.event h4 a[href^="/events/"]');
    if (!eventLink) return [];
    const id = eventIdFromUrl(eventLink.getAttribute('href') ?? '');
    if (id === null) return [];
    const dateText = text(item.querySelector('.date p'));
    const timeText = text(
      Array.from(item.querySelectorAll('.event .place')).find((node) => text(node).includes('開演'))
    );
    const placeLink = item.querySelector<HTMLAnchorElement>('.event .place a[href^="/places/"]');
    const actors = Array.from(
      item.querySelectorAll<HTMLAnchorElement>('.actor a[href^="/actors/"]')
    ).map((link) => entityFromLink(link, baseUrl));
    const image = item.querySelector<HTMLImageElement>('.date img');
    return [
      {
        id,
        name: text(eventLink),
        date: dateText.match(/\d{4}-\d{2}-\d{2}/u)?.[0] ?? null,
        weekday: dateText.match(/\(([^)]+)\)/u)?.[1] ?? null,
        ...parseTimes(timeText),
        place: placeLink ? entityFromLink(placeLink, baseUrl) : null,
        actors,
        note_count: numberFromText(text(item.querySelector('.note_count p'))),
        image_url: image ? absoluteUrl(image.src, baseUrl) : null,
        url: absoluteUrl(`/events/${id}`, baseUrl),
        is_past: item.classList.contains('past')
      }
    ];
  });
}

function linksAfterHeading(
  document: Document,
  heading: string,
  hrefPrefix: string
): HTMLAnchorElement[] {
  const headings = Array.from(document.querySelectorAll('h2,h3,h4'));
  const matched = headings.find((node) => text(node).includes(heading));
  const list = nextElement(matched, 'ul');
  return list ? Array.from(list.querySelectorAll(`a[href^="${hrefPrefix}"]`)) : [];
}

function nextElement(start: Element | undefined, tagName: string): Element | null {
  let node = start?.nextElementSibling ?? null;
  while (node) {
    if (node.tagName.toLowerCase() === tagName) return node;
    node = node.nextElementSibling;
  }
  return null;
}

function actorFromLink(
  link: HTMLAnchorElement,
  baseUrl: string,
  source: ActorSource,
  rank: number | null
): ActorSummary {
  const id = actorIdFromUrl(link.getAttribute('href') ?? '');
  if (id === null) {
    throw new EventernoteError('parse_error', 'Invalid actor link');
  }
  return {
    id,
    name: text(link),
    kana: null,
    initial: null,
    favorite_count: null,
    image_url: null,
    url: absoluteUrl(`/actors/${id}`, baseUrl),
    rank,
    source
  };
}

function entityFromLink(link: HTMLAnchorElement, baseUrl: string): EntityLink {
  const href = link.getAttribute('href') ?? '';
  const id = entityIdFromUrl(href);
  if (id === null) {
    throw new EventernoteError('parse_error', `Invalid entity link: ${href}`);
  }
  return {
    id,
    name: text(link),
    url: absoluteUrl(href, baseUrl)
  };
}

function actorEntityFromApi(raw: RawActor, baseUrl: string): EntityLink {
  const id = asNumber(raw.id);
  const name = asString(raw.name);
  if (id === null || !name) {
    throw new EventernoteError('parse_error', 'Invalid actor API entity');
  }
  return { id, name, url: absoluteUrl(`/actors/${id}`, baseUrl) };
}

function placeEntityFromApi(raw: RawPlace, baseUrl: string): EntityLink | null {
  const id = asNumber(raw.id);
  const name = asString(raw.place_name);
  if (id === null || !name) return null;
  return { id, name, url: absoluteUrl(`/places/${id}`, baseUrl) };
}

function tableRows(document: Document, selector: string): Map<string, string> {
  const rows = new Map<string, string>();
  for (const row of Array.from(document.querySelectorAll<HTMLTableRowElement>(selector))) {
    const cells = Array.from(row.querySelectorAll('td'));
    const key = text(cells[0]);
    const value = text(cells[1]);
    if (key) rows.set(key, value);
  }
  return rows;
}

function rowElement(document: Document, label: string): HTMLTableCellElement | null {
  for (const row of Array.from(document.querySelectorAll<HTMLTableRowElement>('tr'))) {
    const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>('td'));
    if (text(cells[0]) === label) return cells[1] ?? null;
  }
  return null;
}

function hrefFromRow(document: Document, label: string, baseUrl: string): string | null {
  const href = rowElement(document, label)?.querySelector<HTMLAnchorElement>('a[href]')?.href;
  return href ? absoluteUrl(href, baseUrl) : null;
}

function parseTimes(
  textValue: string
): Pick<EventSummary, 'open_time' | 'start_time' | 'end_time'> {
  return {
    open_time: textValue.match(/開場\s*([0-9:]+)/u)?.[1] ?? null,
    start_time: textValue.match(/開演\s*([0-9:]+)/u)?.[1] ?? null,
    end_time: textValue.match(/終演\s*([0-9:]+)/u)?.[1] ?? null
  };
}

function parseParticipantsCount(document: Document): number | null {
  const heading = Array.from(document.querySelectorAll('h2')).find((node) =>
    text(node).includes('このイベントに参加のイベンター')
  );
  return numberFromText(text(heading).match(/\((\d+)人\)/u)?.[1]);
}

function prefectureIdFromBreadcrumb(document: Document): number | null {
  const href = document
    .querySelector<HTMLAnchorElement>('ul.breadcrumb a[href^="/places/prefecture/"]')
    ?.getAttribute('href');
  return href ? numberFromText(href.match(/\/places\/prefecture\/(\d+)/u)?.[1]) : null;
}

function parseLatLon(html: string): Pick<PlaceSummary, 'latitude' | 'longitude'> {
  return {
    latitude: numberFromText(html.match(/var\s+lat\s*=\s*'([^']+)'/u)?.[1]),
    longitude: numberFromText(html.match(/var\s+lon\s*=\s*'([^']+)'/u)?.[1])
  };
}

function stripPostalCode(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/〒\d{3}-\d{4}\s*/u, '').trim() || null;
}

function eventIdFromUrl(url: string): number | null {
  return numberFromText(url.match(/\/events\/(\d+)/u)?.[1]);
}

function actorIdFromUrl(url: string): number | null {
  return numberFromText(url.match(/\/actors\/(?:[^/]+\/)?(\d+)/u)?.[1]);
}

function placeIdFromUrl(url: string): number | null {
  return numberFromText(url.match(/\/places\/(\d+)/u)?.[1]);
}

function entityIdFromUrl(url: string): number | null {
  return eventIdFromUrl(url) ?? actorIdFromUrl(url) ?? placeIdFromUrl(url);
}

function isPastDate(date: string | null): boolean {
  if (!date) return false;
  const parsed = Date.parse(`${date}T23:59:59+09:00`);
  return Number.isFinite(parsed) && parsed < Date.now();
}

function absoluteUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}

function text(node: Element | null | undefined): string {
  return node?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asNullableString(value: unknown): string | null {
  const valueString = asString(value).trim();
  return valueString || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return numberFromText(typeof value === 'string' ? value : undefined);
}

function numberFromText(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/gu, '');
  const match = normalized.match(/-?\d+(?:\.\d+)?/u);
  if (!match) return null;
  const numberValue = Number(match[0]);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
