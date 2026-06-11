import { AREA_IDS, PREFECTURE_IDS } from './constants.js';
import { EventernoteError } from './errors.js';
import {
  actorFromApi,
  eventFromApi,
  parseActorDetail,
  parseActorHome,
  parseActorRanking,
  parseCrumb,
  parseDocument,
  parseEventDetail,
  parseEventList,
  parsePlaceDetail,
  placeFromApi
} from './parsers.js';
import type {
  ActorDetail,
  ActorSummary,
  EntityLink,
  EventDetail,
  EventSummary,
  EventernoteClientOptions,
  ListEventsOptions,
  PageOption,
  PlaceDetail,
  PlaceSummary
} from './types.js';

type ApiResponse<T> = {
  code?: number;
  results?: T;
};

type SearchResult<T> = {
  results: T[];
};

type VerticalSearchResult = {
  events: EventSummary[];
  actors: ActorSummary[];
  places: PlaceSummary[];
};

export class EventernoteClient {
  readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private crumb: string | null = null;

  constructor(options: EventernoteClientOptions = {}) {
    this.baseUrl = options.base_url ?? 'https://www.eventernote.com';
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  async searchActors(input: { keyword?: string } & PageOption): Promise<ActorSummary[]> {
    const keyword = input.keyword?.trim();
    if (!keyword) {
      throw new EventernoteError(
        'invalid_argument',
        'actor list requires a keyword unless --popular or --new is used'
      );
    }
    const data = await this.getJson<ApiResponse<unknown[]>>('/api/actors/search', {
      keyword,
      crumb: await this.getCrumb(),
      ...pageParams(input.page)
    });
    return this.unwrapArray(data).map((item) => actorFromApi(item, this.baseUrl));
  }

  async listPopularActors(input: PageOption = {}): Promise<ActorSummary[]> {
    try {
      const html = await this.getText('/actors/ranking', pageParams(input.page));
      const actors = parseActorRanking(html, this.baseUrl);
      if (actors.length > 0) return actors;
    } catch {
      // Fall back to the home page section below.
    }
    const html = await this.getText('/actors/', pageParams(input.page));
    return parseActorHome(html, this.baseUrl, 'popular');
  }

  async listNewActors(input: PageOption = {}): Promise<ActorSummary[]> {
    const html = await this.getText('/actors/', pageParams(input.page));
    return parseActorHome(html, this.baseUrl, 'new');
  }

  async getActor(idOrName: string): Promise<ActorDetail> {
    const actor = await this.resolveActor(idOrName);
    const { html, url } = await this.getTextWithUrl(`/actors/${actor.id}`);
    return parseActorDetail(html, this.baseUrl, url);
  }

  async searchPlaces(
    input: { keyword?: string; prefecture?: string } & PageOption
  ): Promise<PlaceSummary[]> {
    const keyword = input.keyword?.trim();
    if (keyword) {
      const data = await this.getJson<ApiResponse<unknown[]>>('/api/places/search', {
        keyword,
        crumb: await this.getCrumb(),
        ...pageParams(input.page)
      });
      return this.unwrapArray(data).map((item) => placeFromApi(item, this.baseUrl));
    }
    if (input.prefecture) {
      const prefectureId = this.resolvePrefectureId(input.prefecture);
      const html = await this.getText(`/places/prefecture/${prefectureId}`, pageParams(input.page));
      return parsePlacePrefectureList(html, this.baseUrl);
    }
    throw new EventernoteError('invalid_argument', 'place list requires a keyword or --prefecture');
  }

  async getPlace(idOrName: string): Promise<PlaceDetail> {
    const place = await this.resolvePlace(idOrName);
    const { html, url } = await this.getTextWithUrl(`/places/${place.id}`);
    return parsePlaceDetail(html, this.baseUrl, url);
  }

  async listEvents(options: ListEventsOptions = {}): Promise<EventSummary[]> {
    const actor = options.actor ? await this.resolveActor(options.actor) : null;
    const place = options.place ? await this.resolvePlace(options.place) : null;

    if (actor) {
      const html = await this.getText(`/actors/${actor.id}/events`, pageParams(options.page));
      return this.filterEvents(parseEventList(html, this.baseUrl), options, place?.id);
    }

    if (place) {
      const html = await this.getText(`/places/${place.id}/events`, pageParams(options.page));
      return this.filterEvents(parseEventList(html, this.baseUrl), options, place.id);
    }

    const params = this.eventSearchParams(options);
    const html = await this.getText('/events/search', params);
    return parseEventList(html, this.baseUrl);
  }

  async getEvent(idOrName: string): Promise<EventDetail> {
    const event = await this.resolveEvent(idOrName);
    const { html, url } = await this.getTextWithUrl(`/events/${event.id}`);
    return parseEventDetail(html, this.baseUrl, url);
  }

  async verticalSearch(keyword: string): Promise<VerticalSearchResult> {
    const data = await this.getJson<ApiResponse<unknown[]>>('/api/vertical/search', {
      keyword,
      crumb: await this.getCrumb()
    });
    const first = this.unwrapArray(data)[0] ?? {};
    if (!isRecord(first)) {
      return { events: [], actors: [], places: [] };
    }
    return {
      events: Array.isArray(first.events)
        ? first.events.filter(isRecord).map((item) => eventFromApi(item, this.baseUrl))
        : [],
      actors: Array.isArray(first.actors)
        ? first.actors.filter(isRecord).map((item) => actorFromApi(item, this.baseUrl))
        : [],
      places: Array.isArray(first.places)
        ? first.places.filter(isRecord).map((item) => placeFromApi(item, this.baseUrl))
        : []
    };
  }

  private async resolveActor(idOrName: string): Promise<EntityLink> {
    const id = numericId(idOrName);
    if (id !== null) return { id, name: idOrName, url: absoluteUrl(`/actors/${id}`, this.baseUrl) };
    const actors = await this.searchActors({ keyword: idOrName });
    return resolveByName(idOrName, actors);
  }

  private async resolvePlace(idOrName: string): Promise<EntityLink> {
    const id = numericId(idOrName);
    if (id !== null) return { id, name: idOrName, url: absoluteUrl(`/places/${id}`, this.baseUrl) };
    const places = await this.searchPlaces({ keyword: idOrName });
    return resolveByName(idOrName, places);
  }

  private async resolveEvent(idOrName: string): Promise<EntityLink> {
    const id = numericId(idOrName);
    if (id !== null) return { id, name: idOrName, url: absoluteUrl(`/events/${id}`, this.baseUrl) };
    const vertical = await this.verticalSearch(idOrName);
    if (vertical.events.length > 0) return resolveByName(idOrName, vertical.events);
    const events = await this.listEvents({ keyword: idOrName });
    return resolveByName(idOrName, events);
  }

  private async getCrumb(): Promise<string> {
    if (this.crumb) return this.crumb;
    this.crumb = parseCrumb(await this.getText('/'));
    return this.crumb;
  }

  private async getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const { html } = await this.getTextWithUrl(path, params);
    try {
      return JSON.parse(html) as T;
    } catch (cause) {
      throw new EventernoteError('parse_error', `Failed to parse JSON from ${path}`, { cause });
    }
  }

  private async getText(path: string, params?: Record<string, string>): Promise<string> {
    return (await this.getTextWithUrl(path, params)).html;
  }

  private async getTextWithUrl(
    path: string,
    params: Record<string, string> = {}
  ): Promise<{ html: string; url: string }> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    let response: Response;
    try {
      response = await this.fetchFn(url);
    } catch (cause) {
      throw new EventernoteError('network_error', `Failed to request ${url.toString()}`, {
        cause
      });
    }
    if (response.status === 404) {
      throw new EventernoteError('not_found', `Not found: ${url.toString()}`);
    }
    if (!response.ok) {
      throw new EventernoteError(
        'network_error',
        `Request failed with HTTP ${response.status}: ${url.toString()}`
      );
    }
    return { html: await response.text(), url: response.url || url.toString() };
  }

  private unwrapArray(data: ApiResponse<unknown[]>): Record<string, unknown>[] {
    if (data.code !== 200 || !Array.isArray(data.results)) {
      throw new EventernoteError('parse_error', 'Unexpected API response');
    }
    return data.results.filter(isRecord);
  }

  private eventSearchParams(options: ListEventsOptions): Record<string, string> {
    const params: Record<string, string> = {};
    if (options.keyword) params.keyword = options.keyword;
    if (options.date) {
      const match = options.date.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
      if (!match) {
        throw new EventernoteError('invalid_argument', '--date must be YYYY-MM-DD');
      }
      params.year = String(Number(match[1]));
      params.month = String(Number(match[2]));
      params.day = String(Number(match[3]));
    }
    if (options.region) params.area_id = String(this.resolveAreaId(options.region));
    if (options.prefecture)
      params.prefecture_id = String(this.resolvePrefectureId(options.prefecture));
    Object.assign(params, pageParams(options.page));
    return params;
  }

  private filterEvents(
    events: EventSummary[],
    options: ListEventsOptions,
    placeId: number | undefined
  ): EventSummary[] {
    const keyword = options.keyword?.toLowerCase();
    return events.filter((event) => {
      if (placeId && event.place?.id !== placeId) return false;
      if (options.date && event.date !== options.date) return false;
      if (keyword) {
        const haystack = [event.name, event.place?.name, ...event.actors.map((actor) => actor.name)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  private resolveAreaId(value: string): number {
    const id = AREA_IDS.get(value);
    if (!id) throw new EventernoteError('invalid_argument', `Unknown region: ${value}`);
    return id;
  }

  private resolvePrefectureId(value: string): number {
    const id = PREFECTURE_IDS.get(value);
    if (!id) throw new EventernoteError('invalid_argument', `Unknown prefecture: ${value}`);
    return id;
  }
}

function resolveByName<T extends { id: number; name: string; url: string }>(
  input: string,
  items: T[]
): EntityLink {
  if (items.length === 0) {
    throw new EventernoteError('not_found', `No result found for: ${input}`);
  }
  const exact = items.filter((item) => item.name === input);
  if (exact.length === 1) return exact[0];
  if (items.length === 1) return items[0];
  throw new EventernoteError('ambiguous_result', `Multiple results found for: ${input}`, {
    candidates: items.slice(0, 10).map(({ id, name, url }) => ({ id, name, url }))
  });
}

function parsePlacePrefectureList(html: string, baseUrl: string): PlaceSummary[] {
  const document = parseDocument(html);
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/places/"]'))
    .map<PlaceSummary | null>((link) => {
      const id = numericId(link.getAttribute('href')?.match(/\/places\/(\d+)/u)?.[1] ?? '');
      if (id === null) return null;
      return {
        id,
        name: link.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
        prefecture_id: null,
        address: null,
        postal_code: null,
        tel: null,
        capacity: null,
        web_url: null,
        seat_url: null,
        latitude: null,
        longitude: null,
        url: absoluteUrl(`/places/${id}`, baseUrl)
      } satisfies PlaceSummary;
    })
    .filter((place): place is PlaceSummary => place !== null && Boolean(place.name));
}

function numericId(value: string): number | null {
  if (!/^\d+$/u.test(value.trim())) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function pageParams(page: string | number | undefined): Record<string, string> {
  if (page === undefined || page === '') return {};
  const value = typeof page === 'number' ? String(page) : page.trim();
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new EventernoteError('invalid_argument', '--page must be a positive integer');
  }
  return { page: value };
}

function absoluteUrl(path: string, baseUrl: string): string {
  return new URL(path, baseUrl).toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
