import { createFileRoute } from "@tanstack/react-router"
import { BookOpen, Globe2, LifeBuoy } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/dashboard/web/guides")({ component: WebGuides })

const guides = [
  {
    title: "Homepage content",
    description: "Keep the public website’s key information clear, current and easy to find.",
    icon: Globe2,
  },
  {
    title: "Publishing checklist",
    description: "Review links, language, accessibility and page details before publishing.",
    icon: BookOpen,
  },
  {
    title: "Support",
    description: "Contact the web team when content needs technical or editorial review.",
    icon: LifeBuoy,
  },
] as const

function WebGuides() {
  return (
    <div className="animate-appear">
      <PageHeader
        eyebrow="Web"
        title="Homepage guides"
        description="Operational notes for keeping PoliNetwork’s public content accurate and accessible."
      />
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {guides.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="[--card-spacing:--spacing(5)]">
            <CardHeader>
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="leading-5">{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Documentation content is maintained by the web operations team.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
