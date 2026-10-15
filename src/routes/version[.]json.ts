import { createFileRoute } from "@tanstack/react-router";
import { APP_VERSION } from "@/lib/app-version";

export const Route = createFileRoute("/version.json")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { version: APP_VERSION },
          { headers: { "cache-control": "no-store, no-cache, must-revalidate, max-age=0" } },
        ),
    },
  },
});
