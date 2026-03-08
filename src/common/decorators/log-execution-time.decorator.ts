import { Logger } from '@nestjs/common';

export interface LogExecutionTimeOptions {
  /** Display label; defaults to method name */
  label?: string;
  /** Optional context to append to completion log, e.g. "(input size: X bytes)" */
  context?: (args: unknown[]) => string;
}

/**
 * Method decorator that logs start and elapsed time, similar to Spring's @Timed.
 * Works with sync and async methods.
 * Uses instance `logger` if present, otherwise a Logger with the class name.
 */
export function LogExecutionTime(options?: LogExecutionTimeOptions) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const label = options?.label ?? propertyKey;
    const getContext = options?.context;

    descriptor.value = function (this: { logger?: Logger }, ...args: unknown[]) {
      const logger =
        this.logger ?? new Logger(target.constructor?.name ?? 'Unknown');
      const startMs = Date.now();
      logger.log(`${label} started`);

      const logCompleted = (elapsedMs: number, err?: unknown) => {
        const suffix = getContext ? ` (${getContext(args)})` : '';
        if (err !== undefined) {
          logger.warn(`${label} failed after ${elapsedMs} ms${suffix}`);
        } else {
          logger.log(`${label} completed in ${elapsedMs} ms${suffix}`);
        }
      };

      const result = original.apply(this, args);

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).then(
          (res) => {
            logCompleted(Date.now() - startMs);
            return res;
          },
          (err) => {
            logCompleted(Date.now() - startMs, err);
            throw err;
          },
        );
      }

      logCompleted(Date.now() - startMs);
      return result;
    };

    return descriptor;
  };
}
