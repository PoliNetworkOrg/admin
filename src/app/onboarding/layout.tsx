import { Header } from "@/components/header"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar scrollbar-w-2 scrollbar-track-card scrollbar-thumb-white/20 flex h-screen w-full flex-col items-center justify-start overflow-y-auto">
      <Header />
      {children}
    </div>
  )
}
