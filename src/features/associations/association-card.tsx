import { Languages, LinkIcon, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ASSOCIATION_LINK_FIELDS, getAssociationInitials } from "./associations.constants"
import type { Association } from "./types"

export function AssociationCard({
  association,
  onEdit,
  onEditLinks,
  onDelete,
}: {
  association: Association
  onEdit: () => void
  onEditLinks: () => void
  onDelete: () => void
}) {
  const linkCount = ASSOCIATION_LINK_FIELDS.filter(({ key }) => association.links[key]).length

  return (
    <Card className="h-full">
      <CardHeader className="grid-cols-[1fr_auto] gap-x-4">
        <CardTitle className="flex min-w-0 items-center gap-3 text-lg">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted text-sm font-semibold text-muted-foreground">
            {association.logo ? (
              <img src={association.logo} alt="" className="size-full object-contain p-1" />
            ) : (
              getAssociationInitials(association.name)
            )}
          </span>
          <span className="truncate">{association.name}</span>
        </CardTitle>
        <CardAction className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${association.name}`} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button variant="destructive" size="icon-sm" aria-label={`Delete ${association.name}`} onClick={onDelete}>
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Description language="IT" text={association.descriptionIt} />
          <Description language="EN" text={association.descriptionEn} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <Badge variant="secondary">
            {linkCount} {linkCount === 1 ? "public link" : "public links"}
          </Badge>
          <Button variant="outline" size="sm" onClick={onEditLinks}>
            <LinkIcon data-icon="inline-start" /> Manage links
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Description({ language, text }: { language: string; text: string }) {
  return (
    <section className="min-w-0 rounded-lg bg-muted/45 p-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        <Languages className="size-3.5" /> {language}
      </div>
      <p className="line-clamp-5 text-sm leading-6 text-foreground/85">{text}</p>
    </section>
  )
}
