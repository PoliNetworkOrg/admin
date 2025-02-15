"use server";

import { users } from "../db/schema";
import { db } from "../db";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { USER_ROLE, type TUserRole } from "@/constants";
import { providerMap } from "@/server/auth/config";

export async function changeUserRole(values: {
  id: string;
  newRole: TUserRole;
}) {
  await db
    .update(users)
    .set({
      role: values.newRole,
    })
    .where(eq(users.id, values.id));

  revalidatePath("/admin/hr/users");
}

export type UserWithAccountProviders = {
  id: string;
  name: string;
  email: string;
  role: TUserRole;
  image: string | null;
  accounts: { provider: string }[];
};

export async function getUsers({
  excludedIds,
  includeInactive,
  includeDisabled,
  includeAdminOrg,
  doNotParseProviders,
}: {
  excludedIds?: string[];
  includeInactive?: boolean;
  includeDisabled?: boolean;
  includeAdminOrg?: boolean;
  doNotParseProviders?: boolean;
} = {}) {
  const users = await db.query.users.findMany({
    where: (t, { ne, notInArray, and }) =>
      and(
        notInArray(t.id, excludedIds ?? []),
        includeAdminOrg ? undefined : ne(t.role, USER_ROLE.ADMIN_ORG), // ne = not equal
        includeInactive ? undefined : ne(t.role, USER_ROLE.INACTIVE),
        includeDisabled ? undefined : ne(t.role, USER_ROLE.DISABLED),
      ),
    with: { accounts: { columns: { provider: true } } },
  });

  if (!doNotParseProviders)
    users.forEach((u) =>
      u.accounts.forEach((a) => {
        a.provider =
          providerMap.find((p) => p.id === a.provider)?.name ??
          a.provider
            .split("-")
            .map((e) => e.slice(0, 1).toUpperCase() + e.slice(1))
            .join(" ");
      }),
    );

  return users;
}
