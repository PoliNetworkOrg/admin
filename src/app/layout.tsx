import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import "@/index.css";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { Header, HEADER_HEIGHT } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

const desc = "PoliNetwork Admin Dashboard";

export const metadata: Metadata = {
  title: {
    default: "PoliNetwork Admin",
    template: "%s | PoliNetwork Admin",
  },
  description: desc,
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable}`}
    >
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
          defaultTheme="system"
          enableSystem
          storageKey="polinetwork_darkmode"
          disableTransitionOnChange
        >
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
