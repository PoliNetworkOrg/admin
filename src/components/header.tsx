import { GlobeIcon } from "lucide-react"
import Link from "next/link"
import { ThemeButton } from "@/components/theme-button"
import { HeaderLoginButton } from "./header-login-button"
import { Logo } from "./logo"
import { Button } from "./ui/button"

export const HEADER_HEIGHT = "3.3rem"

export async function Header() {
  return (
    <header className="bg-accent/40 sticky top-4 backdrop-blur-xl rounded-2xl isolate z-20 flex h-(--header-height) w-full max-w-4xl shrink-0 items-center justify-center space-x-6 px-4">
      <Link href="/">
        <div className="flex items-center space-x-4">
          <Logo size={32} />
          <h1 className="text-accent-foreground text-md font-normal">
            <span className="font-semibold hidden md:inline">PoliNetwork</span> Admin
          </h1>
        </div>
      </Link>
      <nav className="flex grow items-center justify-end space-x-8"></nav>
      <nav className="flex items-stretch space-x-2 sm:space-x-3">
        <ThemeButton />
        <Button disabled variant="ghost" size="icon">
          <GlobeIcon size={20} />
        </Button>
        <HeaderLoginButton />
      </nav>
    </header>
  )
}
