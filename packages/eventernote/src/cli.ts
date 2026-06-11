import { breadc } from 'breadc';

import { version, description } from '../package.json';

export const app = breadc('eventernote', { version, description });

await app.run(process.argv.slice(2)).catch((error) => {
  console.error(error);
});
