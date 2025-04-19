import Image from "next/image";
import { GlobeIcon } from "lucide-react";
import Link from "next/link";
import { ThemeButton } from "@/components/theme-button";
import { Button } from "./ui/button";

export const HEADER_HEIGHT = "4.5rem";

export async function Header() {
  return (
    <header className="sticky top-0 isolate z-20 flex h-(--header-height) w-full shrink-0 items-center justify-center border-b bg-card">
      <div className="container mx-auto flex items-center justify-center space-x-6 px-4">
        <Link href="/">
          <div className="flex items-center space-x-4">
            <Image
              src="https://raw.githubusercontent.com/PoliNetworkOrg/Logo/refs/heads/master/Logo.svg"
              alt="PoliNetwork Logo"
              width={40}
              height={40}
            />
            <h1 className="hidden text-2xl font-bold text-accent-foreground md:block">
              PoliNetwork Admin
            </h1>
          </div>
        </Link>
        <nav className="flex grow items-center justify-end space-x-8"></nav>
        <nav className="flex items-center space-x-6">
          <ThemeButton />
          <Button
            disabled
            className="hover:text-accent-foreground [&_svg]:size-6"
            variant="ghost"
            size="icon"
          >
            <GlobeIcon />
          </Button>
        </nav>
      </div>
    </header>
  );
}
