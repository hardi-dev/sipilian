/**
 * Successful result variant carrying a value.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Failed result variant carrying an error.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Discriminated union representing either success or a handled error.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Builds a successful result.
 * @param value - The success payload to wrap.
 * @returns An Ok result containing the value.
 */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/**
 * Builds a failed result.
 * @param error - The error payload to wrap.
 * @returns An Err result containing the error.
 */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/**
 * Type guard narrowing a result to its Ok variant.
 * @param result - The result to inspect.
 * @returns True when the result is Ok.
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

/**
 * Type guard narrowing a result to its Err variant.
 * @param result - The result to inspect.
 * @returns True when the result is Err.
 */
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;
