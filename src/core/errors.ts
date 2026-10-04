type ErrorCode =
  | "UNKNOWN_DEPENDENCY"
  | "CIRCULAR_DEPENDENCY"
  | "DUPLICATE_TRANSFORM"
  | "INVALID_CONTEXT"
  | "INVALID_TRANSFORM";

export class SculptError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SculptError";
  }
}
