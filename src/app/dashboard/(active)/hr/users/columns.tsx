"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { USER_ROLE, type TUserRole } from "@/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Ban, Check } from "lucide-react";
import { useTransition } from "react";
import {
  changeUserRole,
  type UserWithAccountProviders as User,
} from "@/server/actions/users";

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: (cell) => (
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8 rounded-lg">
          {cell.row.original.image && (
            <AvatarImage
              src={cell.row.original.image}
              alt={cell.getValue<string>()}
            />
          )}
          <AvatarFallback className="rounded-lg">
            {getInitials(cell.getValue<string>())}
          </AvatarFallback>
        </Avatar>
        <p>{cell.getValue<string>()}</p>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "accounts",
    header: "Account Provider(s)",
    cell: (cell) => {
      const accounts = cell.getValue<{ provider: string }[]>();
      return accounts.map((a) => a.provider).join(", ");
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: (cell) => {
      const role = cell.getValue<TUserRole>();
      if (role === USER_ROLE.ADMIN_ORG)
        return <span className="font-bold">Owner</span>;
      if (role === USER_ROLE.MEMBER) return "Member";
      if (role === USER_ROLE.INACTIVE)
        return (
          <span className="text-amber-600 dark:text-amber-300">Inactive</span>
        );
      if (role === USER_ROLE.DISABLED)
        return <span className="text-destructive">Disabled</span>;
    },
  },
  {
    id: "role-actions",
    cell: ({ row }) => {
      const role: TUserRole = row.original.role;
      if (role === USER_ROLE.ADMIN_ORG) return <></>;

      return (
        <div className="flex w-full items-center justify-end gap-2">
          <AllowUser data={row.original} disabled={role === USER_ROLE.MEMBER} />
          <DisableUser
            data={row.original}
            disabled={role === USER_ROLE.DISABLED}
          />
        </div>
      );
    },
  },
];

function AllowUser({ data, disabled }: { data: User; disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleDisable() {
    startTransition(() =>
      changeUserRole({ id: data.id, newRole: USER_ROLE.MEMBER }),
    );
  }

  return (
    <Button
      onClick={handleDisable}
      disabled={disabled || isPending}
      size="icon"
      variant="success"
    >
      <Check />
    </Button>
  );
}

function DisableUser({ data, disabled }: { data: User; disabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleDisable() {
    startTransition(() =>
      changeUserRole({ id: data.id, newRole: USER_ROLE.DISABLED }),
    );
  }

  return (
    <Button
      onClick={handleDisable}
      disabled={disabled || isPending}
      size="icon"
      variant="destructive"
    >
      <Ban />
    </Button>
  );
}
