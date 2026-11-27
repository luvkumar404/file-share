import { HTTPException } from "hono/http-exception";

export function parseId(value: string): number {
  const id = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id) || id > 2147483647) {
    throw new HTTPException(400, { message: "Invalid ID." });
  }
  return id;
}

export function publicShare<T extends { password_hash: string | null }>(share: T) {
  const { password_hash, ...data } = share;
  return { ...data, password_protected: Boolean(password_hash) };
}
