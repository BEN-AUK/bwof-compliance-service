import { InvalidJsonOrSchemaError } from '../errors';
import type { z } from 'zod';

/**
 * Parse a JSON string and validate with a Zod schema.
 * Throws InvalidJsonOrSchemaError (HTTP-agnostic) on parse or validation failure.
 * The presentation layer (e.g. GlobalExceptionFilter) maps it to 422 Unprocessable Entity.
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
    throw new InvalidJsonOrSchemaError(errorCode);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidJsonOrSchemaError(errorCode);
  }
  return result.data;
}
