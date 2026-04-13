import type { Metadata } from "next"
import { Geist, Poppins } from "next/font/google"
import "@/index.css"
import { HEADER_HEIGHT } from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils/shadcn"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const desc = "PoliNetwork Admin Dashboard"

export const metadata: Metadata = {
  title: {
    default: "PoliNetwork Admin",
    template: "%s | PoliNetwork Admin",
  },
  description: desc,
  icons: [{ rel: "icon", url: "/favicon.ico" }],
}

const poppins = Poppins({ weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"], subsets: ["latin"] })

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(poppins.className, "font-sans", geist.variable)}>
      <body
        style={
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            "--header-height": HEADER_HEIGHT,
          } as React.CSSProperties
        }
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          // TODO: revert to the following when light theme is ready
          // defaultTheme="system"
          // enableSystem
          // storageKey="polinetwork_darkmode"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex h-screen overflow-y-auto w-full flex-col items-center justify-start px-4 sm:px-8">
              {children}
            </div>
            <Toaster richColors position="bottom-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
