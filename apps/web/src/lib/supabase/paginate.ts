import type { PostgrestError } from '@supabase/supabase-js'

// PostgREST (this Supabase project) enforces a hard server-side max-rows cap
// (~1000) on every read, independent of any .limit() the client requests.
// A query that would return more rows than the cap does NOT error — it just
// silently returns a truncated page. For a billing product that's a
// correctness landmine: any unpaginated read over the cap silently drops rows
// with no signal.
//
// This helper loops a query across successive .range() windows until a page
// comes back with fewer than PAGE_SIZE rows, then returns the full
// accumulated array. Completeness no longer depends on staying under the cap.
const PAGE_SIZE = 1000

/**
 * Paginate a Supabase/PostgREST read past the server-side row cap.
 *
 * `buildQuery` must construct and return a *fresh* query for each page
 * (applying `.range(from, to)` before returning) — do not reuse a single
 * query builder instance across calls.
 *
 * Preserve the original query's exact `.select(...)`, filters, and
 * `.order(...)` inside `buildQuery`; only the `.range(...)` window changes
 * between calls. An explicit `.order(...)` is required upstream of `.range()`
 * for pagination to be deterministic.
 */
export async function paginateQuery<T>(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const all: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    if (!data || data.length === 0) break

    all.push(...data)

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { data: all, error: null }
}
