import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, BookOpen, Database, ShieldCheck, UsersRound } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

const areas = [
  {
    title: "Telegram users",
    description: "Search people and inspect membership details, roles, messages, and audit history.",
    to: "/dashboard/telegram/users",
    icon: UsersRound,
    service: "Telegram",
  },
  {
    title: "Telegram groups",
    description: "Review community metadata, invite links, and public visibility.",
    to: "/dashboard/telegram/groups",
    icon: Database,
    service: "Telegram",
  },
  {
    title: "Access grants",
    description: "Review active and scheduled temporary access for Telegram members.",
    to: "/dashboard/telegram/grants",
    icon: ShieldCheck,
    service: "Telegram",
  },
  {
    title: "Microsoft 365 groups",
    description: "Review directory groups and manage their Microsoft 365 memberships.",
    to: "/dashboard/azure/groups",
    icon: Database,
    service: "Azure",
  },
  {
    title: "Azure members",
    description: "Manage association numbers and Microsoft 365 license information.",
    to: "/dashboard/azure/members",
    icon: UsersRound,
    service: "Azure",
  },
  {
    title: "Web guides",
    description: "Read the operational notes for maintaining PoliNetwork public content.",
    to: "/dashboard/web/guides",
    icon: BookOpen,
    service: "Web",
  },
] as const

export const Route = createFileRoute("/dashboard/")({ component: Overview })

function Overview() {
  return (
    <div className="animate-appear">
      <PageHeader
        eyebrow="Workspace"
        title="Operations overview"
        description="Choose an area to manage PoliNetwork members, communities, permissions, and public content."
      />

      <Card className="mt-6 border-primary/15 bg-card [--card-spacing:--spacing(6)]">
        <CardContent className="flex items-center justify-between gap-8 max-[720px]:flex-col max-[720px]:items-start">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Administrator workspace</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Everything starts with a real workflow.</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every destination below opens a working view backed by the existing PoliNetwork services. Availability and
              errors are reported inside each area instead of being represented by decorative status indicators.
            </p>
          </div>
          <div className="grid shrink-0 gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" /> Search and inspect records
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" /> Manage authorized changes
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" /> Review account security
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="mt-8" aria-labelledby="areas-heading">
        <div className="mb-4">
          <h3 id="areas-heading" className="text-lg font-semibold tracking-[-0.025em]">
            Administrative areas
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Open a focused workspace for the task at hand.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          {areas.map(({ title, description, to, icon: Icon, service }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <Card className="h-full transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/45 group-hover:shadow-[0_10px_28px_rgb(15_23_42/8%)] dark:group-hover:shadow-none">
                <CardContent className="flex h-full items-start gap-4 p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                      {service}
                    </span>
                    <span className="mt-1 block text-base font-semibold tracking-[-0.02em]">{title}</span>
                    <span className="mt-2 block text-sm leading-5 text-muted-foreground">{description}</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
