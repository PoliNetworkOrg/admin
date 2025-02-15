"use client";
import type { TUser } from "@/server/db/schema";
import { type LucideIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getInitials } from "@/lib/utils";

type Props = {
  user: TUser;
  icon?: LucideIcon;
  buttonAction?: (user: TUser) => Promise<void>;
};

export function UserCard({ user, icon: Icon = XIcon, buttonAction }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex w-full items-center gap-2">
      <Avatar className="h-8 w-8 rounded-lg">
        {user.image && (
          <AvatarImage src={user.image} alt={`propic of ${user.name}`} />
        )}
        <AvatarFallback className="rounded-lg">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <p className="grow">{user.name}</p>
      <p className="truncate">{user.email}</p>
      {buttonAction && (
        <Button
          onClick={() => startTransition(() => buttonAction(user))}
          disabled={isPending}
          size="icon"
          variant="ghost"
        >
          <Icon />
        </Button>
      )}
    </div>
  );
}
