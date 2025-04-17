"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { auth, useSession } from "@/lib/auth";
import { APIError } from "better-auth/api";
import { useEffect, useMemo, useState } from "react";
import { InputWithPrefix } from "@/components/input-prefix";
import { Code } from "@/components/code";
import { toast } from "sonner";
import { ClockAlertIcon } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

export function Telegram() {
  const { data: session, isPending } = useSession();
  if (isPending) return <></>;
  const { user } = session!;

  return user.telegramUsername && user.telegramId ? (
    <ShowTelegram username={user.telegramUsername} userId={user.telegramId} />
  ) : (
    <LinkTelegram />
  );
}

function ShowTelegram({
  username,
  userId,
}: {
  username: string;
  userId: number;
}) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.tg.permissions.getRole.queryOptions({ userId }),
  );
  return (
    <>
      <span>@{username}</span>
      {!isLoading && data && data.role !== "user" && (
        <span className="text-xs text-foreground/30">(role: {data.role})</span>
      )}
    </>
  );
}

function LinkTelegram() {
  const [open, setOpen] = useState(false);
  const { refetch } = useSession();
  function handleComplete() {
    toast.success("Telegram link completed!");
    refetch();
    localStorage.removeItem("linktg");
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link your Telegram</DialogTitle>
          <div className="flex min-h-40 flex-col justify-center">
            <Form onComplete={handleComplete} />
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function getSaved() {
  const saved = localStorage.getItem("linktg");
  if (!saved) return null;
  const { username, code, ttl, startTime } = JSON.parse(saved) as {
    username: string;
    code: string;
    ttl: number;
    startTime: number;
  };

  const leftTime = ttl - (Date.now() - startTime) / 1000;
  if (leftTime <= 0) {
    localStorage.removeItem("linktg");
    return null;
  }

  return { username, leftTime, code, ttl };
}

function Form({ onComplete }: { onComplete: () => void }) {
  const saved = useMemo(() => getSaved(), []);
  const [username, setUsername] = useState<string>(saved?.username ?? "");
  const [code, setCode] = useState<string | null>(saved?.code ?? null);
  const [ttl, setTTL] = useState<number | null>(saved?.leftTime ?? null);
  const [expired, setExpired] = useState<boolean>(false);

  async function handleSubmit(
    e:
      | React.FormEvent<HTMLFormElement>
      | React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) {
    e.stopPropagation();
    e.preventDefault();
    if (username.length === 0) return;
    const res = await auth.telegram.link.start({
      telegramUsername: username,
    });

    if (res.error) return console.error("custom error", res.error);
    if (res.data instanceof APIError)
      return console.error("better-auth APIError", res.data);
    setExpired(false);
    setCode(res.data.code);
    setTTL(res.data.ttl);

    localStorage.setItem(
      "linktg",
      JSON.stringify({
        code: res.data.code,
        ttl: res.data.ttl,
        startTime: Date.now(),
        username,
      }),
    );
  }

  function reset() {
    setTTL(null);
    setCode(null);
    setExpired(false);
    setUsername("");
    localStorage.removeItem("linktg");
  }

  useEffect(() => {
    if (!code || !ttl) return;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const interval = setInterval(async () => {
      const res = await auth.telegram.link.verify({ query: { code } });

      if (res.error) return console.error("custom error", res.error);
      if (res.data instanceof APIError)
        return console.error("better-auth APIError", res.data);

      if (res.data.verified) {
        clearInterval(interval);
        onComplete();
        return;
      }

      if (res.data.expired) {
        setExpired(true);
        localStorage.removeItem("linktg");
        setTTL(null);
        setCode(null);
        clearInterval(interval);
        return;
      }

      console.log("polling... not verified or expired");
    }, 5000);
    return () => clearInterval(interval);
  }, [code, onComplete, ttl]);

  if (expired)
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <ClockAlertIcon size={64} />
        <p>Code Expired!</p>
        <Button onClick={handleSubmit}>Regenerate</Button>
      </div>
    );

  return code && ttl ? (
    <div className="flex flex-col items-center gap-4 pb-4 pt-8">
      <p className="flex items-center justify-between gap-4 text-4xl">
        {code.split("").map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </p>
      <Timer
        ttl={saved?.ttl ?? ttl}
        timeLeft={ttl}
        onEnd={() => setExpired(true)}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline">
          <a
            aria-label="open telegram bot"
            href="tg://resolve?domain=pn_ts_dev_bot"
          >
            Start the bot
          </a>
        </Button>
        <p>and then send</p>
        <Code copyOnClick>/link</Code>
      </div>

      <p className="pt-2 text-xs text-foreground/30">
        Having troubles with this code?{" "}
        <button className="underline" onClick={reset}>
          Click to reset
        </button>
      </p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <Label htmlFor="username">Username</Label>
        <InputWithPrefix
          prefix="@"
          id="username"
          autoComplete="off"
          min={1}
          value={username}
          pattern="^[^@]*"
          onChange={(e) => setUsername(e.target.value.replaceAll("@", ""))}
          placeholder="example"
        />
      </div>
      <Button type="submit">Inizia</Button>
    </form>
  );
}

function Timer({
  ttl,
  timeLeft: pTimeLeft,
  onEnd,
}: {
  ttl: number;
  timeLeft: number;
  onEnd: () => void;
}) {
  const ttlMs = ttl * 1000;
  const [timeLeft, setTimeLeft] = useState<number>(pTimeLeft * 1000);

  const percentage = (timeLeft / ttlMs) * 100;
  useEffect(() => {
    if (timeLeft === 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 100) {
          clearInterval(interval);
          onEnd();
          return 0;
        }
        return timeLeft - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [onEnd, timeLeft]);

  return (
    <>
      <Progress
        value={percentage}
        className="h-2 w-64"
        indicatorClassname={
          timeLeft < 31_000 ? "bg-red-600 dark:bg-red-400" : "bg-primary"
        }
      />
      <span className="text-sm text-foreground/70">
        Time left:
        <span className="inline-block w-10 text-end">
          {Math.floor(timeLeft / 1000)}s
        </span>
      </span>
    </>
  );
}
