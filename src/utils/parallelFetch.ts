/**
 * Run async work over `items` with at most `concurrency` requests in flight.
 * Preserves result order (same index as `items`).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const n = Math.max(1, Math.min(concurrency, items.length));

  const worker = async () => {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) {
        return;
      }
      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
