/**
 * Artificial latency for the mock API.
 *
 * Off by default: MSW answers in single-digit milliseconds, so anything we add
 * here is pure waiting for whoever is using the app. Set VITE_MOCK_LATENCY to
 * a number of milliseconds when you deliberately want to see loading and
 * in-flight states — reviewing skeletons, or checking that a modal really does
 * stay open until a save confirms.
 */
export const MOCK_LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY ?? 0)
