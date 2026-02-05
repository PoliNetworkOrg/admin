import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "@/index.css"
import { HEADER_HEIGHT, Header } from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TRPCReactProvider } from "@/lib/trpc/client"
import { HydrateClient } from "@/lib/trpc/server"

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
    <html lang="en" suppressHydrationWarning className={poppins.className}>
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
            <TRPCReactProvider>
              <HydrateClient>
                <div className="flex h-screen w-full flex-col items-center justify-start px-4 sm:px-8">
                  <Header />
                  {children}
                </div>
              </HydrateClient>
            </TRPCReactProvider>
            <Toaster richColors position="bottom-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
