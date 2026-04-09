import Link from "next/link"
import { HeaderLoginButton } from "./header-login-button"
import { Logo } from "./logo"

export async function AdminHeader() {
  return (
    <header className="bg-accent/40 sticky top-4 backdrop-blur-xl rounded-2xl isolate z-20 flex h-(--header-height) w-full container shrink-0 items-center justify-center space-x-6 px-4">
      <Link href="/dashboard">
        <Logo size={32} />
      </Link>
      <nav className="flex grow items-center justify-center gap-6">
        <Link href="/dashboard" className="hover:underline">
          Home
        </Link>
        <Link href="/dashboard/assoc" className="hover:underline">
          Azure
        </Link>
      </nav>
      <nav className="flex items-stretch space-x-2 sm:space-x-3">
        <HeaderLoginButton />
      </nav>
    </header>
  )
}
