"use client"
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { signIn } from "@/lib/auth";

export function Github({ callbackURL }: { callbackURL: string }) {
  return (
    <Button
      type="submit"
      variant="secondary"
      onClick={async () => {
        await signIn.social({
          provider: "github",
          callbackURL,
        })
      }}
      className="grid w-full min-w-60 grid-cols-[auto_1fr] grid-rows-1 space-x-2 bg-white py-6 hover:bg-white/80"
    >
      <Image
        className="justify-self-end"
        src={`https://authjs.dev/img/providers/github.svg`}
        unoptimized
        alt={`logo of github`}
        width={24}
        height={24}
      />
      <span className="justify-self-start text-black">GitHub</span>
    </Button>
  );
}
