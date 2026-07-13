import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowUpRight, BookOpen, Database, ShieldCheck, UsersRound } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const areas = [
  {
    title: "Telegram users",
    description: "Search people, inspect member details, roles, messages and audit history.",
    to: "/dashboard/telegram/users",
    icon: UsersRound,
  },
  {
    title: "Telegram groups",
    description: "Review group metadata, invite links and public visibility.",
    to: "/dashboard/telegram/groups",
    icon: Database,
  },
  {
    title: "Access grants",
    description: "Review ongoing and scheduled temporary access grants.",
    to: "/dashboard/telegram/grants",
    icon: ShieldCheck,
  },
  {
    title: "Azure members",
    description: "Manage association numbers and Microsoft 365 licenses.",
    to: "/dashboard/azure/members",
    icon: UsersRound,
  },
  {
    title: "Web guides",
    description: "Open the operational notes for maintaining public web content.",
    to: "/dashboard/web/guides",
    icon: BookOpen,
  },
] as const

export const Route = createFileRoute("/dashboard/")({ component: Overview })

function Overview() {
  return (
    <div className="animate-appear">
      <PageHeader
        eyebrow="Workspace"
        title="Operations overview"
        description="Choose an area to manage PoliNetwork members, communities and access. Only tools available to your administrator role are shown."
      />
      <section className="mt-6 grid grid-cols-2 gap-4 max-[760px]:grid-cols-1" aria-label="Administrative areas">
        {areas.map(({ title, description, to, icon: Icon }) => (
          <Card key={to} className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="max-w-md leading-5">{description}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-end bg-muted/35">
              <Button variant="ghost" size="sm" render={<Link to={to} />} nativeButton={false}>
                Open area
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  )
}
