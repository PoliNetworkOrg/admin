import { AUTH_PATH } from "@polinetwork/backend"
import { createAuthClient } from "better-auth/react"

import { createAuthPlugins } from "@/lib/auth-plugins"

export const auth = createAuthClient({
  basePath: AUTH_PATH,
  plugins: createAuthPlugins(),
})

export const { signIn, signOut, useSession } = auth

export type AdminSession = NonNullable<Awaited<ReturnType<typeof auth.getSession>>["data"]>
