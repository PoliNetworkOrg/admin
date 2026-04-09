import Link from "next/link"
import { Logo } from "../logo"
import { RightNav } from "./right-nav"

export function AdminHeader() {
  return (
    <header className="bg-accent/40 sticky top-4 backdrop-blur-xl rounded-2xl isolate z-20 grid grid-cols-[7rem_1fr_7rem] h-(--header-height) w-full container shrink-0 items-center justify-center space-x-6 px-4">
      <Link href="/dashboard">
        <Logo size={32} />
      </Link>
      <nav className="flex grow items-center justify-center gap-6">
        <Link href="/dashboard" className="hover:underline">
          Home
        </Link>
        <Link href="/dashboard/azure" className="hover:underline">
          Azure
        </Link>
      </nav>
      <nav className="flex justify-end items-center h-full">
        <RightNav />
      </nav>
    </header>
  )
}
