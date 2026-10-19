import { Pencil } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

import { ConfirmDialog, IconButton, InlineAlert, SectionCard, TableSkeleton } from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { FreshmanCardRow } from "./freshman-card"
import { FreshmanCardDialog } from "./freshman-card-dialog"
import { FreshmanFaqDialog } from "./freshman-faq-dialog"
import { freshmanApi, FreshmanDemoDataError } from "./freshman.api"
import { FRESHMAN_RESOURCE_GROUPS, type FreshmanTab } from "./freshman.constants"
import { freshmanFaqCatalog } from "./freshman.data"
import type { FreshmanCard, FreshmanContent, FreshmanCardSection } from "./types"

type Editing =
  | { section: "resources" | "telegram"; card: FreshmanCard }
  | { section: "faqs"; index: number; faqId: string }

export function FreshmanPage({ tab, navigation }: { tab: Exclude<FreshmanTab, "guide">; navigation: ReactNode }) {
  const canWrite = useCan("web:content:write")
  const [content, setContent] = useState<FreshmanContent | null>(null)
  const [loadError, setLoadError] = useState<"corrupt" | "unavailable" | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)

  useEffect(() => {
    let ignore = false
    freshmanApi
      .getContent()
      .then((result) => {
        if (!ignore) {
          setContent(result)
          setLoadError(null)
        }
      })
      .catch((error) => {
        console.error(error)
        if (!ignore) setLoadError(error instanceof FreshmanDemoDataError ? "corrupt" : "unavailable")
      })
    return () => {
      ignore = true
    }
  }, [attempt])

  function saved(result: FreshmanContent) {
    setContent(result)
    setEditing(null)
    appToast.success("Demo changes saved in this browser.")
  }

  async function move(section: FreshmanCardSection, id: string, direction: -1 | 1) {
    setMoving(true)
    try {
      setContent(await freshmanApi.moveCard(section, id, direction))
      appToast.success("Demo order saved in this browser.")
    } catch (error) {
      console.error(error)
      appToast.error("The demo order could not be saved.")
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
        onMove={(direction) => void move(section, card.id, direction)}
        onEdit={() => setEditing({ section, card })}
      />
    ))
  }

  return (
    <>
      <PageBar description="Manage the fixed content slots on the freshman page." left={navigation} />
      <PageContent>
        <div className="flex flex-col gap-5">
          <InlineAlert tone="info">
            Demo content · Changes are saved only in this browser and do not update the public website. The number of
            items is fixed.
          </InlineAlert>
          {loadError ? (
            <InlineAlert>
              {loadError === "corrupt"
                ? "Saved demo content is invalid. Restore the initial demo content to start again."
                : "Browser storage is unavailable. Allow site storage, then retry."}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
                  Retry
                </Button>
                {loadError === "corrupt" && canWrite && (
                  <Button variant="outline" onClick={() => setResetOpen(true)}>
                    Restore demo content
                  </Button>
                )}
              </div>
            </InlineAlert>
          ) : !content ? (
            <TableSkeleton columns={3} rows={5} label="Loading freshman content…" />
          ) : (
            <>
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
                  description="Five fixed positions. Choose from the demo FAQ catalog; selecting an existing question swaps its position."
                  padding="flush"
                >
                  {content.faqIds.map((id, index) => {
                    const faq = freshmanFaqCatalog.find((item) => item.id === id)!
                    return (
                      <div key={index} className="flex items-start gap-3 border-b border-(--pn-line) p-4 last:border-0">
                        <span className="mt-0.5 font-mono text-xs text-(--pn-fg-muted)">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium">{faq.question}</h3>
                          <p className="mt-1 text-[13px] text-(--pn-fg-muted)">{faq.answer}</p>
                        </div>
                        {canWrite && (
                          <IconButton
                            label="Choose FAQ"
                            ariaLabel={`Choose FAQ for position ${index + 1}`}
                            icon={Pencil}
                            onClick={() => setEditing({ section: "faqs", index, faqId: id })}
                          />
                        )}
                      </div>
                    )
                  })}
                </SectionCard>
              )}
            </>
          )}
        </div>
      </PageContent>
      {canWrite && (
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Restore demo content?"
          description="Replace your locally saved Freshman demo edits with the initial content. Other browser data and the public website are unaffected."
          confirmLabel="Restore demo content"
          onConfirm={async () => {
            const restored = await freshmanApi.resetContent()
            setContent(restored)
            setLoadError(null)
            setEditing(null)
            appToast.success("Demo content restored in this browser.")
          }}
        />
      )}
      {editing &&
        canWrite &&
        (editing.section === "faqs" ? (
          <FreshmanFaqDialog
            index={editing.index}
            initialId={editing.faqId}
            onClose={() => setEditing(null)}
            onSaved={saved}
          />
        ) : (
          <FreshmanCardDialog
            card={editing.card}
            section={editing.section}
            onClose={() => setEditing(null)}
            onSaved={saved}
          />
        ))}
    </>
  )
}
