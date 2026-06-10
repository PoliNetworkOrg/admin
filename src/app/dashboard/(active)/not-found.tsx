import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-heading text-[12rem] leading-none font-bold tracking-tight text-primary">404</h1>
        <h2 className="font-heading text-2xl font-semibold text-foreground">Not found</h2>
        <p className="max-w-sm text-muted-foreground">
          The resource you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link href=".">
        <Button>Go Back</Button>
      </Link>
    </div>
  )
}
