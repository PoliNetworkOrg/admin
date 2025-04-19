"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { signIn } from "@/lib/auth";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/spinner";

export function Github({ callbackURL }: { callbackURL: string }) {
  const [isLoading, start] = useTransition();
  return (
    <Button
      type="submit"
      variant="secondary"
      onClick={async () => {
        start(
          () =>
            new Promise((res) => {
              setTimeout(res, 1000);
            }),
        );
        await signIn.social({
          provider: "github",
          callbackURL,
        });
      }}
      className={cn(
        "w-full min-w-52 py-6",
        isLoading
          ? "flex cursor-not-allowed items-center justify-center bg-white/20 text-white hover:bg-white/20"
          : "grid grid-cols-[auto_1fr] grid-rows-1 cursor-pointer bg-white hover:bg-white/80",
      )}
    >
      {isLoading ? (
        <Spinner className="h-5 w-5 dark:fill-white dark:text-gray-400" />
      ) : (
        <>
          <Image
            className="justify-self-end"
            src={`https://authjs.dev/img/providers/github.svg`}
            unoptimized
            alt={`logo of github`}
            width={24}
            height={24}
          />
          <span className="justify-center text-black">Sign in with GitHub</span>
        </>
      )}
    </Button>
  );
}
