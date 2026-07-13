/**
 * Machine-readable API error codes shared across handlers.
 */
export type ApiErrorCode =
  "validation_failed" | "not_found" | "forbidden" | "conflict" | "unprocessable";

/**
 * Expected API error returned by handlers instead of throwing.
 */
export interface ApiError {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly message: string;
}

/**
 * HTTP-shaped body produced when serialising an ApiError at the framework edge.
 */
export interface HttpErrorBody {
  readonly code: ApiErrorCode;
  readonly message: string;
}

/**
 * HTTP status + body pair for an ApiError.
 */
export interface HttpError {
  readonly status: number;
  readonly body: HttpErrorBody;
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  validation_failed: 422,
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  unprocessable: 422,
};

/**
 * Builds an ApiError with the HTTP status mapped from its code.
 * @param code - The machine-readable error code.
 * @param message - A developer-facing English message.
 * @returns The assembled ApiError.
 */
export function apiError(code: ApiErrorCode, message: string): ApiError {
  return { code, httpStatus: STATUS_BY_CODE[code], message };
}

/**
 * Maps an ApiError to its HTTP status and serialisable body.
 * @param error - The ApiError to translate.
 * @returns The HTTP status and body.
 */
export function toHttp(error: ApiError): HttpError {
  return { status: error.httpStatus, body: { code: error.code, message: error.message } };
}
