import type { EntityLink, JsonFail } from './types.js';

export type EventernoteErrorCode = JsonFail['code'];

export class EventernoteError extends Error {
  readonly code: EventernoteErrorCode;
  readonly candidates?: EntityLink[];

  constructor(
    code: EventernoteErrorCode,
    message: string,
    options: { candidates?: EntityLink[]; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'EventernoteError';
    this.code = code;
    this.candidates = options.candidates;
  }
}

export function toEventernoteError(error: unknown): EventernoteError {
  if (error instanceof EventernoteError) {
    return error;
  }
  if (error instanceof Error) {
    return new EventernoteError('network_error', error.message, {
      cause: error
    });
  }
  return new EventernoteError('network_error', String(error));
}
