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
     * Development only: the member number of the socio the agent-mode user is in My area, or `none`. In the sample
     * register 7 has a rejected receipt to upload again, 4 one waiting for review, 1 has paid, 34 is exempt and 41's
     * fee isn't open yet.
     */
    AGENT_SOCIO: z.string().default("7"),
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
