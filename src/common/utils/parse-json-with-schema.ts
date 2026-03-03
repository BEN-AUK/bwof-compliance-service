import { BadGatewayException } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Parse a JSON string and validate with a Zod schema.
 * Throws BadGatewayException with the given errorCode on parse or validation failure.
 * Reusable for AI responses, webhooks, or any JSON payload that must match a schema.
 */
export function parseJsonWithSchema<T>(
  raw: string,
  schema: z.ZodType<T>,
  errorCode = 'error.invalid_json',
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadGatewayException(errorCode);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new BadGatewayException(errorCode);
  }
  return result.data;
}
