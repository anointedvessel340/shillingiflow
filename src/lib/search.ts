/**
 * Sanitize free-text search input before it is used in a Supabase/PostgREST
 * `.ilike()` (or any `.or()`) filter. Characters below have structural
 * meaning in PostgREST filter syntax or in SQL LIKE patterns:
 *
 *   PostgREST filter: ,  (  )  *  .
 *   SQL LIKE:         %  _  \
 *
 * Escaping them ensures user input is only ever treated as a literal
 * search string, never as filter/pattern syntax — closing the injection
 * vector where a term like `test,or(id.neq.0` could alter which rows
 * the query matches.
 */
export function sanitizeSearch(input: string): string {
  return input
    // SQL LIKE metacharacters first (escape the backslash before anything else).
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    // PostgREST filter metacharacters.
    .replace(/[,()*]/g, " ")
    .trim();
}
