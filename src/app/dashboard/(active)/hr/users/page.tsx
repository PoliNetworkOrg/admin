import { DataTable } from "@/components/data-table";
import { ArrowRight } from "lucide-react";
import { columns } from "./columns";
import { USER_ROLE } from "@/constants";
import Link from "next/link";
import { getUsers } from "@/server/actions/users";

export default async function HRUsers() {
  const users = await getUsers({
    includeAdminOrg: true,
    includeDisabled: true,
    includeInactive: true,
  });

  const sortedUsers = users.sort((a, b) => {
    if (a.role === b.role) return 0;
    if (a.role === USER_ROLE.ADMIN_ORG) return -1;
    return 1;
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold text-accent-foreground">
        <Link href="/dashboard/hr" className="opacity-50">
          HR
        </Link>
        <ArrowRight /> Users
      </h2>

      <DataTable columns={columns} data={sortedUsers} />
    </main>
  );
}
