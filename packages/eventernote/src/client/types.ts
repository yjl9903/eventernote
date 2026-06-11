export type ActorSource = 'search' | 'popular' | 'new';

export type EntityLink = {
  id: number;
  name: string;
  url: string;
};

export type JsonOk<T> = {
  ok: true;
  data: T;
};

export type JsonFail = {
  ok: false;
  code: 'network_error' | 'not_found' | 'ambiguous_result' | 'parse_error' | 'invalid_argument';
  message: string;
  candidates?: EntityLink[];
};

export type ActorSummary = {
  id: number;
  name: string;
  kana: string | null;
  initial: string | null;
  favorite_count: number | null;
  image_url: string | null;
  url: string;
  rank: number | null;
  source: ActorSource;
};

export type PlaceSummary = {
  id: number;
  name: string;
  prefecture_id: number | null;
  address: string | null;
  postal_code: string | null;
  tel: string | null;
  capacity: string | null;
  web_url: string | null;
  seat_url: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string;
};

export type EventSummary = {
  id: number;
  name: string;
  date: string | null;
  weekday: string | null;
  open_time: string | null;
  start_time: string | null;
  end_time: string | null;
  place: EntityLink | null;
  actors: EntityLink[];
  note_count: number | null;
  image_url: string | null;
  url: string;
  is_past: boolean;
};

export type ActorDetail = {
  actor: ActorSummary;
  fan_count: number | null;
  event_count: number | null;
  all_events_url: string | null;
  recent_events: EventSummary[];
};

export type PlaceDetail = {
  place: PlaceSummary;
  map_url: string | null;
  event_count: number | null;
  events: EventSummary[];
};

export type EventDetail = {
  event: EventSummary;
  links: string[];
  hashtag: string | null;
  description: string | null;
  participants_count: number | null;
};

export type EventernoteClientOptions = {
  base_url?: string;
  fetch?: typeof globalThis.fetch;
};

export type PageOption = {
  page?: string | number;
};

export type ListEventsOptions = {
  keyword?: string;
  date?: string;
  region?: string;
  prefecture?: string;
  actor?: string;
  place?: string;
  page?: string | number;
};
