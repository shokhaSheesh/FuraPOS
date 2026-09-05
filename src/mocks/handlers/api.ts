/**
 * Handler paths are origin-agnostic (`*` prefix) so the same handlers serve
 * the browser worker (same-origin `/api/...`) and Node tests (absolute URLs).
 */
export const api = (path: string) => `*/api${path}`
