/**
 * Thrown when JSON parse fails or payload does not match the expected schema.
 * HTTP-agnostic; let the presentation layer (e.g. GlobalExceptionFilter) map to 422.
 */
export class InvalidJsonOrSchemaError extends Error {
  constructor(
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'InvalidJsonOrSchemaError';
    Object.setPrototypeOf(this, InvalidJsonOrSchemaError.prototype);
  }
}
