"use client"
import { LogInIcon } from "lucide-react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { signIn } from "@/lib/auth"

export function Github({ callbackURL }: { callbackURL: string }) {
  return (
    <button
      type="button"
      className="h-20 min-h-20 w-full"
      onClick={async () => {
        await signIn.social({
          provider: "github",
          callbackURL,
        })
      }}
    >
      <Card className="border-primary from-primary to-primary/20 group relative h-full w-full cursor-pointer overflow-hidden bg-linear-to-r to-60%">
        <div className="bg-primary absolute inset-0 opacity-0 transition duration-250 group-hover:opacity-100"></div>
        <CardContent className="text-primary-foreground absolute inset-0 flex items-center space-x-4 py-4">
          <LogInIcon size={32} />
          <p className="flex-1 text-start text-xl">Enter your reserved area</p>
          <Image
            className="justify-self-end dark:invert-100"
            src={`https://authjs.dev/img/providers/github.svg`}
            unoptimized
            alt={`logo of github`}
            width={28}
            height={28}
          />
        </CardContent>
      </Card>
    </button>
  )
}
