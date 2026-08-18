import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"
import { resolveBackendUrl } from "@/server/runtime-env"

export const env = createEnv({
  server: {
    AGENT_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
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
