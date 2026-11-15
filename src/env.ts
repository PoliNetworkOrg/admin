import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

import { resolveBackendUrl } from "@/server/runtime-env"

export const env = createEnv({
  server: {
    AGENT_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /** Development only: comma-separated permissions for the agent-mode user (default: all of them). */
    AGENT_PERMISSIONS: z.string().optional(),
    /** Development only: the agent-mode user's person record in the People sample data. */
    AGENT_PERSON: z.string().default("P-0007"),
    /**
     * Development only: a bearer token agent mode sends to the backend instead of none, so pages read a real local
     * backend (e.g. one minted by the backend's dev IdP shim). Permissions then come from the backend's `me.access`.
     */
    AGENT_BACKEND_TOKEN: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]),
    BACKEND_URL: z.url(),
  },

  clientPrefix: "VITE_",

  client: {},

  shared: {},

  runtimeEnv: {
    ...process.env,
    BACKEND_URL: resolveBackendUrl(process.env.BACKEND_URL, process.env.NODE_ENV, process.env.npm_lifecycle_event),
  },

  emptyStringAsUndefined: true,
})
