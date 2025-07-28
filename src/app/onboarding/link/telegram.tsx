"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { auth, useSession } from "@/lib/auth";
import { APIError } from "better-auth/api";
import { useCallback, useEffect, useState } from "react";
import { InputWithPrefix } from "@/components/input-prefix";
import { Code } from "@/components/code";
import { CircleCheckBig, ClockAlertIcon } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";

type SavedLink = {
  username: string;
  code: string;
  ttl: number;
  startTime: number;
};

export function TelegramLink({ botUsername }: { botUsername: string }) {
  const router = useRouter()
  const { refetch } = useSession();
  const {
    data: savedLink,
    update,
    remove,
  } = useLocalStorage<SavedLink>("linktg");
  const timeLeft = savedLink
    ? savedLink.ttl - (Date.now() - savedLink.startTime) / 1000
    : null;
  if (timeLeft !== null && timeLeft <= 0) {
    remove();
  }

  const [usernameInput, setUsernameInput] = useState<string>("");
  const [expired, setExpired] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const handleComplete = useCallback(() => {
    setSuccess(true);
    refetch();
    remove();

    setTimeout(() => {
      router.push("/login/success");
    }, 5000);
  }, [router, refetch, remove]);

  async function handleSubmit(
    e:
      | React.FormEvent<HTMLFormElement>
      | React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) {
    e.stopPropagation();
    e.preventDefault();
    if (usernameInput.length === 0) return;
    const res = await auth.telegram.link.start({
      telegramUsername: usernameInput,
    });

    if (res.error) return console.error("custom error", res.error);
    if (res.data instanceof APIError)
      return console.error("better-auth APIError", res.data);
    setExpired(false);
    update({
      code: res.data.code,
      startTime: Date.now(),
      ttl: res.data.ttl,
      username: usernameInput,
    });
  }

  function reset() {
    setExpired(false);
    setUsernameInput("");
    remove();
  }

  useEffect(() => {
    if (savedLink === undefined || savedLink === null) return;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const interval = setInterval(async () => {
      const res = await auth.telegram.link.verify({
        query: { code: savedLink.code },
      });

      if (res.error) return console.error("custom error", res.error);
      if (res.data instanceof APIError)
        return console.error("better-auth APIError", res.data);

      if (res.data.verified) {
        clearInterval(interval);
        handleComplete();
        return;
      }

      if (res.data.expired) {
        setExpired(true);
        remove();
        clearInterval(interval);
        return;
      }

      console.log("polling... not verified or expired");
    }, 5000);
    return () => clearInterval(interval);
  }, [savedLink, handleComplete, remove]);

  if (savedLink === undefined) return <></>;
  if (success)
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <CircleCheckBig
          className="text-green-500 dark:text-green-700"
          size={64}
        />
        <p className="text-xl font-bold">Linked successfully!</p>
        <p className="text-muted-foreground">Redirecting you in 5s...</p>
      </div>
    );

  if (expired)
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <ClockAlertIcon size={64} />
        <p>Code Expired!</p>
        <Button onClick={handleSubmit}>Regenerate</Button>
      </div>
    );

  return savedLink && timeLeft ? (
    <div className="flex flex-col items-center gap-4">
      <p className="flex items-center justify-between gap-4 text-4xl">
        {savedLink.code.split("").map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </p>
      <Timer
        ttl={savedLink.ttl}
        timeLeft={timeLeft}
        onEnd={() => setExpired(true)}
      />

      <div className="flex items-center gap-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button variant="outline">
              <a
                aria-label="open telegram bot"
                href={`tg://resolve?domain=${botUsername}`}
              >
                Start the bot
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">@{botUsername}</TooltipContent>
        </Tooltip>
        <p>and then send</p>
        <Code copyOnClick>/link</Code>
      </div>

      <p className="text-muted-foreground pt-2 text-xs">
        Having troubles with this code?{" "}
        <button className="cursor-pointer underline" onClick={reset}>
          Click to reset
        </button>
      </p>
    </div>
  ) : (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-80 flex-col items-center gap-6"
    >
      <div className="flex w-full items-center gap-4">
        <Label htmlFor="username">Username</Label>
        <InputWithPrefix
          prefix="@"
          id="username"
          autoComplete="off"
          required
          min={1}
          value={usernameInput}
          pattern="^[^@]*"
          onChange={(e) => setUsernameInput(e.target.value.replaceAll("@", ""))}
          placeholder="example"
          containerClassName="grow"
        />
      </div>
      <Button className="w-full" type="submit">
        Inizia
      </Button>
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
      <span className="text-foreground/70 text-sm">
        Time left:
        <span className="inline-block w-10 text-end">
          {Math.floor(timeLeft / 1000)}s
        </span>
      </span>
    </>
  );
}
