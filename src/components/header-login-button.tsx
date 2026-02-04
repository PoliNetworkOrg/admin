"use client"
import { LogIn, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { auth, useSession } from "@/lib/auth"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"

export function HeaderLoginButton() {
  const { data, isPending } = useSession()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const router = useRouter()

  if (isPending) return <Skeleton className="bg-accent w-24 rounded-lg flex justify-center items-center" />
  if (data)
    return (
      <Button
        variant="primary"
        className="rounded-lg basis-24"
        onClick={async () => {
          await auth.signOut()
          router.refresh()
        }}
      >
        <LogOut size={20} /> Logout
      </Button>
    )

  return (
    <Link href={"/login"} className="cursor-default">
      <Button
        disabled={pathname.startsWith("/login")}
        variant="primary"
        className="rounded-lg"
        size={isMobile ? "icon" : "default"}
      >
        <LogIn size={20} />
        <span className="max-md:hidden">Login</span>
      </Button>
    </Link>
  )
}
