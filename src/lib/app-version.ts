declare const __APP_VERSION__: string;

/** Build version baked in at build time; identical in the client bundle and the server worker of one build. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** Versions are "YYYYMMDDTHHMMSS-xxxxxx", so lexical comparison orders them by build time. */
export function isOlderThan(running: string, min: string | null | undefined): boolean {
  if (!min) return false;
  return running < min;
}

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(msg);
}
