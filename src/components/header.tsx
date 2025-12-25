import { GlobeIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import logo from "@/assets/svg/logo.svg"
import { ThemeButton } from "@/components/theme-button"
import { Button } from "./ui/button"

export const HEADER_HEIGHT = "3.3rem"

export async function Header() {
  return (
    <header className="bg-sidebar sticky top-0 isolate z-20 flex h-(--header-height) w-full shrink-0 items-center justify-center">
      <div className="container mx-auto flex items-center justify-center space-x-6 px-4">
        <Link href="/login/success">
          <div className="flex items-center space-x-4">
            <Image
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              src={logo}
              alt="PoliNetwork Logo"
              height={32}
              width={32}
            />
            <h1 className="text-accent-foreground hidden text-lg font-bold md:block">PoliNetwork Admin</h1>
          </div>
        </Link>
        <nav className="flex grow items-center justify-end space-x-8"></nav>
        <nav className="flex items-center space-x-3">
          <ThemeButton />
          <Button disabled variant="ghost" size="icon">
            <GlobeIcon size={20} />
          </Button>
        </nav>
      </div>
    </header>
  )
}
