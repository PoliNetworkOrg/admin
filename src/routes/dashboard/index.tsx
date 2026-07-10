import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpRight, CheckCircle2, Database, ShieldCheck, UsersRound } from "lucide-react"
import { cn } from "@/lib/utils"

const actionCards = [
  {
    title: "Review member directory",
    text: "Update association numbers and licenses.",
    to: "/dashboard/azure/members",
    icon: UsersRound,
  },
  {
    title: "Manage access grants",
    text: "Check active and scheduled Telegram grants.",
    to: "/dashboard/telegram/grants",
    icon: ShieldCheck,
  },
  {
    title: "Browse Telegram groups",
    text: "Inspect group metadata and visibility settings.",
    to: "/dashboard/telegram/groups",
    icon: Database,
  },
] as const

export const Route = createFileRoute("/dashboard/")({ component: Overview })

function Overview() {
  return (
    <div className="animate-appear">
      <section className="relative grid min-h-[293px] grid-cols-[minmax(0,1.1fr)_370px] overflow-hidden bg-sidebar px-11 py-10 text-[#f2f4ea] after:absolute after:top-[-158px] after:right-[-138px] after:size-[350px] after:rounded-full after:border after:border-sidebar-primary/30 max-[900px]:grid-cols-1 max-[900px]:px-[33px] max-[600px]:min-h-0 max-[600px]:px-[22px] max-[600px]:py-7">
        <div>
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-sidebar-primary">
            OPERATIONS CONTROL ROOM
          </p>
          <h2 className="mt-[15px] font-serif text-[clamp(29px,3.3vw,48px)] leading-[1.06] tracking-[-0.06em]">
            Everything in order.
            <br />
            <i className="text-sidebar-primary">Nothing overlooked.</i>
          </h2>
          <p className="mt-[15px] max-w-[525px] text-sm leading-[1.55] text-[#bfcac1]">
            A focused workspace for the people who keep PoliNetwork’s communities, access and membership data moving.
          </p>
          <div className="mt-[37px] flex items-center gap-2 font-mono text-[11px] text-[#bdd8fa]">
            <CheckCircle2 className="size-4" />
            <span>Workspace ready for review</span>
            <b className="ml-2.5 font-normal text-[#81958a] max-[600px]:hidden">Last sync — just now</b>
          </div>
        </div>
        <div
          className="relative z-10 grid grid-cols-3 gap-[9px] self-end justify-self-end rotate-[-6deg] max-[900px]:hidden"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              className={cn(
                "size-14",
                index === 1 || index === 3 || index === 5
                  ? "bg-sidebar-primary"
                  : index === 4
                    ? "bg-[#d86b3f]"
                    : "bg-[#17365f]"
              )}
            />
          ))}
        </div>
      </section>
      <section className="mt-[18px] grid grid-cols-3 gap-px border border-border bg-border max-[600px]:grid-cols-1">
        <Metric value="4" label="Operational areas" note="Telegram + Azure" />
        <Metric value="24/7" label="Backend visibility" note="Live when connected" />
        <Metric value="Role-based" label="Access control" note="Sensitive actions protected" />
      </section>
      <section className="mt-[52px] mb-[18px] flex items-end justify-between max-[600px]:mt-[34px] max-[600px]:block">
        <div>
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
            START HERE
          </p>
          <h2 className="mt-2 font-serif text-[25px] leading-[1.1] tracking-[-0.05em]">Choose an operational area</h2>
        </div>
        <p className="text-[11px] text-muted-foreground max-[600px]:mt-2">
          Every workspace is scoped to your administrator role.
        </p>
      </section>
      <section className="grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
        {actionCards.map(({ title, text, to, icon: Icon }, index) => (
          <Link
            key={to}
            to={to}
            className="group grid grid-cols-[37px_1fr_20px] items-start gap-3 border border-border bg-card p-[21px] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-[4px_5px_0_var(--mint)]"
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            <span className="grid size-[37px] place-items-center bg-accent text-primary">
              <Icon className="size-5" />
            </span>
            <span>
              <h3 className="mt-0.5 text-[13px]">{title}</h3>
              <p className="mt-1 text-[11px] leading-[1.45] text-muted-foreground">{text}</p>
            </span>
            <ArrowUpRight className="mt-0.5 size-5 text-primary" />
          </Link>
        ))}
      </section>
    </div>
  )
}

function Metric({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <article className="flex items-center gap-[15px] bg-card px-[21px] py-[19px]">
      <strong className="font-serif text-[25px] leading-none font-normal text-primary">{value}</strong>
      <div>
        <h3 className="text-xs">{label}</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{note}</p>
      </div>
    </article>
  )
}
