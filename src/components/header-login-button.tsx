"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FiLogIn, FiLogOut } from "react-icons/fi"
import { useIsMobile } from "@/hooks/use-mobile"
import { auth, useSession } from "@/lib/auth"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"

export function HeaderLoginButton() {
  const { data, isPending } = useSession()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const router = useRouter()

  if (isPending) return <Skeleton className="bg-accent w-24 rounded-lg flex justify-center items-center" />
  if (data)
    return (
      <Button
        variant="default"
        className="rounded-lg basis-24"
        onClick={async () => {
          await auth.signOut()
          router.refresh()
        }}
      >
        <FiLogOut size={20} /> Logout
      </Button>
    )

  return (
    <Link href={"/login"} className="cursor-default">
      <Button
        disabled={pathname.startsWith("/login")}
        variant="default"
        className="rounded-lg"
        size={isMobile ? "icon" : "default"}
      >
        <FiLogIn size={20} />
        <span className="max-md:hidden">Login</span>
      </Button>
    </Link>
  )
}
