export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const map = <A, B, E>(r: Result<A, E>, f: (a: A) => B): Result<B, E> =>
  r.ok ? Ok(f(r.value)) : r;
