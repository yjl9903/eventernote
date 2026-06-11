import { breadc } from 'breadc';

import { version, description } from '../package.json';

export const app = breadc('eventernote', { version, description }).option(
  '--json',
  'Enable JSON output'
);

const actor = app.group('actor');

actor.command('list [keyword]', 'List actors').action(async () => {});

actor.command('get <id/name>', 'Get actor detail').action(async () => {});

const event = app.group('event');

event
  .command('list [keyword]', 'List events')
  .option('--date <date>')
  .option('--region <region>')
  .option('--prefecture <prefecture>')
  .option('--actor <actor id/name>')
  .option('--place <place id/name>')
  .action(async () => {});

event.command('get <id/name>', 'Get event detail').action(async () => {});

const place = app.group('place');

place
  .command('list [keyword]', 'List places')
  .option('--prefecture <prefecture>')
  .action(async () => {});

place.command('get <id/name>', 'Get place detail').action(async () => {});

await app.run(process.argv.slice(2)).catch((error) => {
  console.error(error);
});
