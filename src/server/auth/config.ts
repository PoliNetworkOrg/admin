import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";

import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import GitHub from "next-auth/providers/github";
import { env } from "@/env";
import type { Provider } from "next-auth/providers";
import { type TUserRole, USER_ROLE } from "@/constants";
import type { Adapter } from "next-auth/adapters";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: TUserRole;
      name: string;
      email: string;
      image?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: TUserRole;
  }
}

const providers: Provider[] = [
  /* @see https://next-auth.js.org/providers/ */
  MicrosoftEntraID({
    clientId: env.AUTH_AZURE_CLIENT_ID,
    clientSecret: env.AUTH_AZURE_CLIENT_SECRET,
    issuer: `https://login.microsoftonline.com/${env.AUTH_AZURE_TENANT_ID}/v2.0`,
    async profile(profile, tokens) {
      // https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0&tabs=http#examples
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/photos/${this.profilePhotoSize}x${this.profilePhotoSize}/$value`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );

      // Confirm that profile photo was returned
      let image;
      // TODO: Do this without Buffer
      if (response.ok && typeof Buffer !== "undefined") {
        try {
          const pictureBuffer = await response.arrayBuffer();
          const pictureBase64 = Buffer.from(pictureBuffer).toString("base64");
          image = `data:image/jpeg;base64, ${pictureBase64}`;
        } catch {}
      }

      const isAdminOrg = profile.email === env.ADMIN_ORG_EMAIL;
      return {
        id: profile.sub,
        name: profile.name as string,
        email: profile.email,
        image: image ?? null,
        role: isAdminOrg ? USER_ROLE.ADMIN_ORG : USER_ROLE.MEMBER,
      };
    },
  }),
];

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ auth }) => {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

export const providerMap = authConfig.providers
  .map((provider) => {
    if (typeof provider === "function") {
      const providerData = provider();
      return { id: providerData.id, name: providerData.name };
    } else {
      return { id: provider.id, name: provider.name };
    }
  })
  .filter((provider) => provider.id !== "credentials");

