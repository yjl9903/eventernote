import type { OutputMode } from './format.js';

export function detectOutputMode(json: boolean): OutputMode {
  if (json) return 'json';
  return process.stdout.isTTY ? 'tty' : 'csv';
}

export function installOutputErrorHandlers(): void {
  process.stdout.on('error', handleStreamError);
  process.stderr.on('error', handleStreamError);
}

export async function writeOutput(text: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      process.stdout.off('error', onError);
      process.stdout.off('drain', onDrain);
    };

    process.stdout.on('error', onError);
    const ready = process.stdout.write(text);
    if (ready) {
      cleanup();
      resolve();
    } else {
      process.stdout.once('drain', onDrain);
    }
  });
}

export function isEpipe(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EPIPE'
  );
}

function handleStreamError(error: Error): void {
  if (isEpipe(error)) {
    process.exit(0);
  }
  throw error;
}
