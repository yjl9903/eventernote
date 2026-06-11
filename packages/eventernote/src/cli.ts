import { breadc } from 'breadc';

import { version } from '../package.json';

import { EventernoteClient, EventernoteError } from './client/index.js';
import { formatDetail, formatList, jsonFail, type OutputMode } from './format.js';
import { detectOutputMode, installOutputErrorHandlers, isEpipe, writeOutput } from './output.js';

export const app = breadc('eventernote', {
  version,
  description:
    'Eventernote https://www.eventernote.com CLI, used for querying actor, event, or place information.'
}).option('--json', 'Output JSON format');

installOutputErrorHandlers();

const actor = app.group('actor');

actor
  .command('list [keyword]', 'List actors')
  .option('--popular', 'List popular actors')
  .option('--new', 'List new actors')
  .option('--page <page>', 'Page number')
  .action(async (keyword, options) => {
    const mode = detectOutputMode(Boolean(options.json));
    const client = new EventernoteClient();
    try {
      const selected = [Boolean(keyword), options.popular, options.new].filter(Boolean).length;
      if (selected > 1) {
        throw new EventernoteError(
          'invalid_argument',
          '[keyword], --popular, and --new are mutually exclusive'
        );
      }
      const data = options.popular
        ? await client.listPopularActors({ page: options.page })
        : options.new
          ? await client.listNewActors({ page: options.page })
          : await client.searchActors({ keyword, page: options.page });
      await writeOutput(formatList('actor', data, mode));
    } catch (error) {
      await handleCommandError(error, mode);
    }
  });

actor.command('get <id,name>', 'Get actor detail').action(async (idOrName, options) => {
  const mode = detectOutputMode(Boolean(options.json));
  const client = new EventernoteClient();
  try {
    await writeOutput(formatDetail('actor', await client.getActor(idOrName), mode));
  } catch (error) {
    await handleCommandError(error, mode);
  }
});

const event = app.group('event');

event
  .command('list [keyword]', 'List events')
  .option('--date <date>')
  .option('--region <region>')
  .option('--prefecture <prefecture>')
  .option('--actor <actor>')
  .option('--place <place>')
  .option('--page <page>', 'Page number')
  .action(async (keyword, options) => {
    const mode = detectOutputMode(Boolean(options.json));
    const client = new EventernoteClient();
    try {
      await writeOutput(
        formatList(
          'event',
          await client.listEvents({
            keyword,
            date: options.date,
            region: options.region,
            prefecture: options.prefecture,
            actor: options.actor,
            place: options.place,
            page: options.page
          }),
          mode
        )
      );
    } catch (error) {
      await handleCommandError(error, mode);
    }
  });

event.command('get <id,name>', 'Get event detail').action(async (idOrName, options) => {
  const mode = detectOutputMode(Boolean(options.json));
  const client = new EventernoteClient();
  try {
    await writeOutput(formatDetail('event', await client.getEvent(idOrName), mode));
  } catch (error) {
    await handleCommandError(error, mode);
  }
});

const place = app.group('place');

place
  .command('list [keyword]', 'List places')
  .option('--prefecture <prefecture>')
  .option('--page <page>', 'Page number')
  .action(async (keyword, options) => {
    const mode = detectOutputMode(Boolean(options.json));
    const client = new EventernoteClient();
    try {
      await writeOutput(
        formatList(
          'place',
          await client.searchPlaces({
            keyword,
            prefecture: options.prefecture,
            page: options.page
          }),
          mode
        )
      );
    } catch (error) {
      await handleCommandError(error, mode);
    }
  });

place.command('get <id,name>', 'Get place detail').action(async (idOrName, options) => {
  const mode = detectOutputMode(Boolean(options.json));
  const client = new EventernoteClient();
  try {
    await writeOutput(formatDetail('place', await client.getPlace(idOrName), mode));
  } catch (error) {
    await handleCommandError(error, mode);
  }
});

await app.run(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function handleCommandError(error: unknown, mode: OutputMode): Promise<void> {
  if (isEpipe(error)) {
    process.exitCode = 0;
    return;
  }
  process.exitCode = 1;
  const message = error instanceof Error ? error.message : String(error);
  await writeOutput(mode === 'json' ? jsonFail(error) : `${message}\n`);
}
