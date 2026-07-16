import { createFileRoute } from "@tanstack/react-router"
import { BookOpen, CheckCircle2, Globe2, LifeBuoy } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/dashboard/web/guides")({ component: WebGuides })

const guides = [
  {
    title: "Homepage content",
    description: "Keep the public website’s key information clear, current, and easy to find.",
    icon: Globe2,
    items: ["Confirm dates and contact details", "Keep the primary action visible", "Remove outdated announcements"],
  },
  {
    title: "Publishing checklist",
    description: "Review the essentials before a change is published to the public website.",
    icon: BookOpen,
    items: ["Test links and downloads", "Review headings and alternative text", "Check mobile and desktop layouts"],
  },
  {
    title: "Support handoff",
    description: "Prepare enough context for the web team to review a technical or editorial issue.",
    icon: LifeBuoy,
    items: ["Include the affected page URL", "Describe the expected result", "Attach a screenshot when useful"],
  },
] as const

function WebGuides() {
  return (
    <div className="animate-appear">
      <PageHeader
        eyebrow="Web"
        title="Homepage guides"
        description="Practical notes for keeping PoliNetwork’s public content accurate, accessible, and ready to publish."
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-3" aria-label="Web operations guidance">
        {guides.map(({ title, description, icon: Icon, items }) => (
          <Card key={title} className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="leading-5">{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
