import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    AGENT_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },

  clientPrefix: "VITE_",

  client: {},

  shared: {
    BACKEND_URL: z.url().default("http://localhost:3000"),
  },

  runtimeEnv: process.env,

  emptyStringAsUndefined: true,
})
