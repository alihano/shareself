/** Recursively stringifies bigint values so API routes can pass on-chain data through Response.json (which throws on raw bigints). */
export function serializeBigInts<T>(value: T): T {
  if (typeof value === "bigint") return value.toString() as unknown as T;
  if (Array.isArray(value)) return value.map(serializeBigInts) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeBigInts(v)])) as T;
  }
  return value;
}
