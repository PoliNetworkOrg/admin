"use client";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { useEffect, useState, useTransition } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CircleCheck, CircleX } from "lucide-react";
import { TTGUser } from "@/server/db/schema";
import { Code } from "./code";
import { cn } from "@/lib/utils";

type Props = {
  trigger?: React.ReactNode;
  users: TTGUser[];
};

export function CreateTgUser({ trigger, users }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [isPending, start] = useTransition();

  const [name, setName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [validUsername, setValidUsername] = useState<boolean | undefined>();

  function handleOpenChange(v: boolean): void {
    setOpen(v);
    setName("");
    setUsername("");
    setValidUsername(undefined);
  }

  function handleConfirm(): void {
    console.log(name, username);
    // TODO
  }

  function handleUsernameChange(s: string): void {
    const localUsername = s.startsWith("@") ? s.slice(1) : s;
    setUsername(localUsername.trim());
    setValidUsername(undefined);
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      if (username !== "") {
        const existing = users.find(u => u.tgUsername.toLowerCase() === username.toLowerCase()) ? true : false;
        setValidUsername(existing);
      } 
    }, 600);

    // Cleanup function to clear the timeout if the component unmounts
    // or if inputValue changes before the delay is over
    return () => {
      clearTimeout(handler);
    };
  }, [username, users]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger ?? <Button variant="outline">New Tg User</Button>}
      </SheetTrigger>
      <SheetContent className="sm:max-w-[40rem]">
        <SheetHeader>
          <SheetTitle>New Telegram User</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              className="max-w-sm"
              type="text"
              autoFocus
              autoComplete="off"
              id="name"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="username">Telegram Username</Label>
            <div className="flex items-center justify-start gap-2">
              <Input
                className="max-w-sm"
                type="text"
                autoComplete="off"
                id="username"
                placeholder="Telegram Username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
              />
              {validUsername !== undefined &&
                (validUsername ? <CircleCheck className="text-green-500" /> : <CircleX className="text-red-600"/>)}
            </div>
            <p className="text-sm">You can insert the username (with or without @).</p>
          </div>
          <p className={cn("text-red-500", validUsername === false ? "opacity-100 pointer-events-auto select-auto" : "opacity-0 pointer-events-none select-none")}>An user with username <Code>@{username}</Code> has already been registered.</p>
        </div>
        <SheetFooter className="mt-4">
          <SheetClose asChild>
            <Button variant="secondary" disabled={isPending}>
              Cancel
            </Button>
          </SheetClose>
          <Button onClick={handleConfirm} disabled={isPending || !validUsername}>
            {isPending ? "Saving..." : "Confirm"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
