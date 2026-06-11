import { Skeleton } from "@/components/ui/skeleton"
import { NewPasskeyButton } from "./passkey-button"

export default function Loading() {
  return (
    <main className="container">
      <h2 className="text-accent-foreground mb-4 text-3xl font-bold">Account</h2>
      <div className="flex gap-4 mb-12">
        <Skeleton className="h-32 w-32 rounded-full" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-accent-foreground/70">Name:</span>
            <Skeleton className="w-40 h-5" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-accent-foreground/70">Email:</span>
            <Skeleton className="w-70 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-accent-foreground/70">Telegram:</span>
            <Skeleton className="w-60 h-5" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 justify-start items-start">
        <h3>Passkeys</h3>
        <Skeleton className="w-full h-10" />
        <NewPasskeyButton />
      </div>
    </main>
  )
}
