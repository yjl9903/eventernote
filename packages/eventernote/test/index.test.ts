import { describe, expect, it } from 'vitest';

import { EventernoteClient } from '../src/client/index.js';
import {
  parseActorDetail,
  parseActorHome,
  parseEventDetail,
  parseEventList,
  parsePlaceDetail
} from '../src/client/parsers.js';
import { formatDetail, formatList, jsonFail, jsonOk } from '../src/format.js';

const baseUrl = 'https://www.eventernote.com';

describe('parsers', () => {
  it('parses actor popular and new sections', () => {
    const html = `
      <h3>人気の声優/アーティスト</h3>
      <ul><li><a href="/actors/%CE%BC/2809">μ's</a></li></ul>
      <h3>新着声優/アーティスト</h3>
      <ul><li><a href="/actors/AKANECLUB./92858">AKANECLUB.</a></li></ul>
    `;

    expect(parseActorHome(html, baseUrl, 'popular')).toEqual([
      expect.objectContaining({ id: 2809, name: "μ's", rank: 1, source: 'popular' })
    ]);
    expect(parseActorHome(html, baseUrl, 'new')).toEqual([
      expect.objectContaining({ id: 92858, name: 'AKANECLUB.', rank: null, source: 'new' })
    ]);
  });

  it('parses event list items', () => {
    const events = parseEventList(
      `
      <div class="gb_event_list"><ul>
        <li class="clearfix past">
          <div class="date"><p>2026-06-12 (<span>金</span>)</p><img src="/e.jpg"></div>
          <div class="event">
            <h4><a href="/events/464506">乱舞 -外伝- 金沢公演</a></h4>
            <div class="place">会場: <a href="/places/138">金沢AZ(アズ)</a></div>
            <div class="place"><span class="s">開場 18:30 開演 19:00 終演 21:00</span></div>
            <div class="actor"><ul><li>出演者:</li><li><a href="/actors/TRUE/9094">TRUE</a></li></ul></div>
          </div>
          <div class="note_count"><p title="参加者数">64</p></div>
        </li>
      </ul></div>
    `,
      baseUrl
    );

    expect(events).toEqual([
      expect.objectContaining({
        id: 464506,
        name: '乱舞 -外伝- 金沢公演',
        date: '2026-06-12',
        weekday: '金',
        open_time: '18:30',
        start_time: '19:00',
        end_time: '21:00',
        note_count: 64,
        is_past: true
      })
    ]);
    expect(events[0]?.place).toEqual({
      id: 138,
      name: '金沢AZ(アズ)',
      url: `${baseUrl}/places/138`
    });
    expect(events[0]?.actors).toEqual([
      { id: 9094, name: 'TRUE', url: `${baseUrl}/actors/TRUE/9094` }
    ]);
  });

  it('parses event detail', () => {
    const detail = parseEventDetail(
      `
      <meta property="og:image" content="https://img.example/event.jpg">
      <div class="gb_events_detail_title"><h2>乱舞 -外伝- 金沢公演</h2></div>
      <div class="gb_events_info_table"><table>
        <tr><td>開催日時</td><td><a href="/events/search?year=2026&month=6&day=12">2026-06-12 (金)</a></td></tr>
        <tr><td>時間</td><td>開場 18:30 開演 19:00 終演 21:00</td></tr>
        <tr><td>開催場所</td><td><a href="/places/138">金沢AZ(アズ)</a></td></tr>
        <tr><td>出演者</td><td><a href="/actors/TRUE/9094">TRUE</a></td></tr>
        <tr><td>関連リンク</td><td><a href="https://true.example">https://true.example</a></td></tr>
        <tr><td>Twitterハッシュタグ</td><td><a href="https://twitter.example">#TRUEさん</a></td></tr>
      </table></div>
      <h2>このイベントに参加のイベンター(64人)</h2>
    `,
      baseUrl,
      `${baseUrl}/events/464506`
    );

    expect(detail.event).toEqual(
      expect.objectContaining({ id: 464506, name: '乱舞 -外伝- 金沢公演', note_count: 64 })
    );
    expect(detail.links).toEqual(['https://true.example/']);
    expect(detail.hashtag).toBe('#TRUEさん');
    expect(detail.participants_count).toBe(64);
  });

  it('parses actor and place details', () => {
    const actor = parseActorDetail(
      `
      <div class="gb_actors_title"><div class="name"><h2>水樹奈々</h2><h2 class="kana">みずきなな</h2></div></div>
      <h2>水樹奈々のファン一覧(<span class="number">6105</span>)</h2>
      <a href="/actors/%E6%B0%B4/28/events">水樹奈々の全てのイベントを見る(834件)</a>
      <script>addFavorite(28)</script>
    `,
      baseUrl,
      `${baseUrl}/actors/28`
    );
    expect(actor.actor).toEqual(
      expect.objectContaining({ id: 28, name: '水樹奈々', kana: 'みずきなな' })
    );
    expect(actor.fan_count).toBe(6105);
    expect(actor.event_count).toBe(834);

    const place = parsePlaceDetail(
      `
      <ul class="breadcrumb"><a href="/places/prefecture/17">石川県の会場一覧</a></ul>
      <div class="gb_place_detail_title"><h2>金沢AZ(アズ)</h2></div>
      <div class="gb_place_detail_table"><table>
        <tr><td>所在地</td><td><a href="http://maps.google.com/maps?q=x">〒920-0971 石川県金沢市鱗町107番地</a></td></tr>
        <tr><td>電話番号</td><td>076-264-2008</td></tr>
        <tr><td>公式サイト</td><td><a href="https://www.kanazawa-az.com/">ウェブサイト</a></td></tr>
        <tr><td>収容人数</td><td>300人</td></tr>
        <tr><td>座席情報</td><td><a href="https://example.com/seat.pdf">座席情報</a></td></tr>
      </table></div>
      <a href="/places/138/events">全てのイベントを見る(149件)</a>
      <script>var lat = '36.5'; var lon = '136.6';</script>
    `,
      baseUrl,
      `${baseUrl}/places/138`
    );
    expect(place.place).toEqual(
      expect.objectContaining({
        id: 138,
        name: '金沢AZ(アズ)',
        prefecture_id: 17,
        postal_code: '〒920-0971',
        capacity: '300人',
        latitude: 36.5,
        longitude: 136.6
      })
    );
    expect(place.event_count).toBe(149);
  });
});

describe('client', () => {
  it('maps actor and place JSON APIs with crumb', async () => {
    const calls: string[] = [];
    const client = new EventernoteClient({
      base_url: baseUrl,
      fetch: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url === `${baseUrl}/`) {
          return response('<meta id="crumb" content="abc">');
        }
        if (url.startsWith(`${baseUrl}/api/actors/search`)) {
          expect(url).toContain('crumb=abc');
          expect(url).toContain('page=2');
          return response(
            JSON.stringify({
              code: 200,
              results: [{ id: 28, name: '水樹奈々', kana: 'みずきなな' }]
            })
          );
        }
        if (url.startsWith(`${baseUrl}/api/places/search`)) {
          expect(url).toContain('crumb=abc');
          expect(url).toContain('page=3');
          return response(
            JSON.stringify({
              code: 200,
              results: [{ id: 138, place_name: '金沢AZ(アズ)', latitude: '36.5' }]
            })
          );
        }
        return response('', 404);
      }
    });

    await expect(client.searchActors({ keyword: '水樹奈々', page: 2 })).resolves.toEqual([
      expect.objectContaining({ id: 28, name: '水樹奈々', kana: 'みずきなな' })
    ]);
    await expect(client.searchPlaces({ keyword: '金沢AZ', page: 3 })).resolves.toEqual([
      expect.objectContaining({ id: 138, name: '金沢AZ(アズ)', latitude: 36.5 })
    ]);
    expect(calls.filter((url) => url === `${baseUrl}/`)).toHaveLength(1);
  });

  it('passes page to event search and validates page values', async () => {
    const client = new EventernoteClient({
      base_url: baseUrl,
      fetch: async (input) => {
        const url = String(input);
        expect(url).toBe(`${baseUrl}/events/search?keyword=TRUE&page=4`);
        return response('<div class="gb_event_list"><ul></ul></div>');
      }
    });

    await expect(client.listEvents({ keyword: 'TRUE', page: '4' })).resolves.toEqual([]);
    await expect(client.listEvents({ keyword: 'TRUE', page: '0' })).rejects.toThrow(
      '--page must be a positive integer'
    );
  });
});

describe('format', () => {
  const event = {
    id: 1,
    name: 'Event, Name',
    date: '2026-06-12',
    weekday: '金',
    open_time: '18:30',
    start_time: '19:00',
    end_time: '21:00',
    place: { id: 2, name: 'Place', url: `${baseUrl}/places/2` },
    actors: [{ id: 3, name: 'Actor', url: `${baseUrl}/actors/3` }],
    note_count: 4,
    image_url: null,
    url: `${baseUrl}/events/1`,
    is_past: false
  };

  it('formats JSON envelope without extra metadata', () => {
    expect(jsonOk([event])).toBe(`${JSON.stringify({ ok: true, data: [event] }, null, 2)}\n`);
    expect(jsonFail(new Error('boom'))).toContain('"ok": false');
    expect(jsonFail(new Error('boom'))).not.toContain('"cmd"');
  });

  it('formats csv list and single-row get', () => {
    expect(formatList('event', [event], 'csv')).toBe(
      [
        'id,name,date,weekday,open_time,start_time,end_time,place_id,place_name,actors,note_count,image_url,url,is_past',
        `1,"Event, Name",2026-06-12,金,18:30,19:00,21:00,2,Place,Actor,4,,${baseUrl}/events/1,false`
      ].join('\n') + '\n'
    );
    expect(
      formatDetail(
        'event',
        {
          event,
          links: ['https://example.com'],
          hashtag: '#tag',
          description: null,
          participants_count: 4
        },
        'csv'
      ).split('\n')
    ).toHaveLength(2);
  });

  it('formats tty tables', () => {
    expect(formatList('event', [event], 'tty')).toContain('ID');
    expect(formatList('event', [event], 'tty')).toContain('Event, Name');
  });
});

function response(body: string, status = 200): Response {
  return new Response(body, { status });
}
