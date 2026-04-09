import { Shape } from "@/components/shapes"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid grow place-content-center">
      {children}
      <div className="-z-10 pointer-events-none fixed inset-0">
        <Shape variant="big-blue" className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/3" />
        <Shape variant="big-blue" className="left-0 top-0 translate-x-1/2 translate-y-1/3 opacity-60" />
        <Shape variant="big-teal" className="left-0 top-0 -translate-x-1/3 translate-y-1/3 opacity-70" />
        <Shape variant="big-teal" className="right-0 top-0 translate-x-1/3 -translate-y-1/3 opacity-45" />
      </div>
    </main>
  )
}
