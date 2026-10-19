import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Pencil } from "lucide-react"
import { type ReactNode, useState } from "react"

import { IconButton, SectionCard } from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { errorMessage } from "@/lib/errors"

import { FreshmanCardRow } from "./freshman-card"
import { FreshmanCardDialog } from "./freshman-card-dialog"
import { FreshmanFaqDialog } from "./freshman-faq-dialog"
import { FRESHMAN_RESOURCE_GROUPS, type FreshmanTab } from "./freshman.constants"
import { moveFreshmanCard } from "./freshman.functions"
import type { FreshmanCard, FreshmanContent, FreshmanCardSection, FreshmanFaq } from "./types"

type Editing = { section: FreshmanCardSection; card: FreshmanCard } | { section: "faqs"; index: number; faqId: number }

export function FreshmanPage({
  content,
  catalog,
  tab,
  navigation,
}: {
  content: FreshmanContent
  catalog: FreshmanFaq[]
  tab: Exclude<FreshmanTab, "guide">
  navigation: ReactNode
}) {
  const router = useRouter()
  const moveFreshmanCardFn = useServerFn(moveFreshmanCard)
  const canWrite = useCan("web:content:write")
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogGeneration, setDialogGeneration] = useState(0)

  function edit(item: Editing) {
    setEditing(item)
    setDialogGeneration((value) => value + 1)
    setDialogOpen(true)
  }

  async function saved() {
    try {
      await router.invalidate({ sync: true })
      appToast.success("Freshman content saved.")
    } catch (error) {
      console.error(error)
      appToast.warning("Your change was saved, but the latest freshman content could not be refreshed.")
    }
    setDialogOpen(false)
  }

  async function move(id: string, direction: -1 | 1) {
    if (moving) return
    setMoving(true)
    try {
      await moveFreshmanCardFn({ data: { id, direction } })
      await saved()
    } catch (error) {
      console.error(error)
      appToast.error(errorMessage(error, "Couldn't save the card order."))
    } finally {
      setMoving(false)
    }
  }

  function cardRows(section: FreshmanCardSection, cards: FreshmanCard[]) {
    return cards.map((card, index) => (
      <FreshmanCardRow
        key={card.id}
        card={card}
        canWrite={canWrite}
        pending={moving}
        first={index === 0}
        last={index === cards.length - 1}
        onMove={(direction) => void move(card.id, direction)}
        onEdit={() => edit({ section, card })}
      />
    ))
  }

  return (
    <>
      <PageBar description="Manage the fixed content slots on the freshman page." left={navigation} />
      <PageContent>
        <div className="flex flex-col gap-5">
          {tab === "resources" &&
            FRESHMAN_RESOURCE_GROUPS.map((group) => (
              <SectionCard key={group.id} title={group.title} padding="flush">
                {cardRows(
                  "resources",
                  content.resources.filter((card) => card.group === group.id)
                )}
              </SectionCard>
            ))}
          {tab === "telegram" && (
            <SectionCard title="Group links" description="Eight fixed positions, in website order." padding="flush">
              {cardRows("telegram", content.telegram)}
            </SectionCard>
          )}
          {tab === "faqs" && (
            <SectionCard
              title="Featured questions"
              description="Five fixed positions. Choose from the FAQ catalog; selecting a featured question swaps its position."
              padding="flush"
            >
              {content.faqs.map((faq, index) => (
                <div key={index} className="flex items-start gap-3 border-b border-(--pn-line) p-4 last:border-0">
                  <span className="mt-0.5 font-mono text-xs text-(--pn-fg-muted)">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{faq.titleIt}</h3>
                    <p className="mt-1 text-[13px] text-(--pn-fg-muted)">{faq.descriptionIt}</p>
                  </div>
                  {canWrite && (
                    <IconButton
                      label="Choose FAQ"
                      ariaLabel={`Choose FAQ for position ${index + 1}`}
                      icon={Pencil}
                      onClick={() => edit({ section: "faqs", index, faqId: faq.faqId })}
                    />
                  )}
                </div>
              ))}
            </SectionCard>
          )}
        </div>
      </PageContent>
      {editing &&
        canWrite &&
        (editing.section === "faqs" ? (
          <FreshmanFaqDialog
            key={dialogGeneration}
            open={dialogOpen}
            index={editing.index}
            initialId={editing.faqId}
            catalog={catalog}
            onClose={() => setDialogOpen(false)}
            onSaved={saved}
          />
        ) : (
          <FreshmanCardDialog
            key={dialogGeneration}
            open={dialogOpen}
            card={editing.card}
            section={editing.section}
            onClose={() => setDialogOpen(false)}
            onSaved={saved}
          />
        ))}
    </>
  )
}
