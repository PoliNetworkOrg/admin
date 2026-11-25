import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Pencil } from "lucide-react"
import { type ReactNode, useState } from "react"

import { IconButton, SectionCard, StatusBadge } from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import type { TgGroup } from "@/lib/api/types"
import { errorMessage } from "@/lib/errors"

import { FreshmanCardRow } from "./freshman-card"
import { FreshmanCardDialog } from "./freshman-card-dialog"
import { FreshmanFaqDialog } from "./freshman-faq-dialog"
import { FreshmanTelegramDialog } from "./freshman-telegram-dialog"
import { FRESHMAN_RESOURCE_GROUPS, type FreshmanTab } from "./freshman.constants"
import { moveFreshmanCard } from "./freshman.functions"
import type { FreshmanCard, FreshmanContent, FreshmanFaq, FreshmanTelegramCard } from "./types"

type Editing =
  | { section: "resources"; card: FreshmanCard }
  | { section: "telegram"; card: FreshmanTelegramCard }
  | { section: "faqs"; index: number; faqId: number }

/** Where a Telegram slot's link comes from: its group, or a legacy link typed before slots linked groups. */
function TelegramDetail({ card }: { card: FreshmanTelegramCard }) {
  const group = card.telegramGroup
  const line = "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--pn-fg-muted)"
  if (!group)
    return (
      <p className={line}>
        <StatusBadge tone="warning">No group linked</StatusBadge>
        {card.href && <span className="break-all">Old link: {card.href}</span>}
      </p>
    )
  return (
    <p className={line}>
      {group.link ? (
        <span className="break-all">{group.link}</span>
      ) : (
        <StatusBadge tone="warning">Group has no invite link</StatusBadge>
      )}
      {card.customTitle && card.customTitle !== group.title && <span>Group: {group.title}</span>}
      {group.hide && <StatusBadge tone="neutral">Hidden group</StatusBadge>}
    </p>
  )
}

export function FreshmanPage({
  content,
  catalog,
  groups,
  tab,
  navigation,
}: {
  content: FreshmanContent
  catalog: FreshmanFaq[]
  /** Telegram tab: the groups a slot can link. */
  groups: TgGroup[]
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

  function cardRow(item: Exclude<Editing, { section: "faqs" }>, index: number, count: number) {
    const { card } = item
    return (
      <FreshmanCardRow
        key={card.id}
        card={card}
        detail={item.section === "telegram" ? <TelegramDetail card={item.card} /> : undefined}
        canWrite={canWrite}
        pending={moving}
        first={index === 0}
        last={index === count - 1}
        onMove={(direction) => void move(card.id, direction)}
        onEdit={() => edit(item)}
      />
    )
  }

  return (
    <>
      <PageBar description="Manage the fixed content slots on the freshman page." left={navigation} />
      <PageContent>
        <div className="flex flex-col gap-5">
          {tab === "resources" &&
            FRESHMAN_RESOURCE_GROUPS.map((group) => (
              <SectionCard key={group.id} title={group.title} padding="flush">
                {content.resources
                  .filter((card) => card.group === group.id)
                  .map((card, index, cards) => cardRow({ section: "resources", card }, index, cards.length))}
              </SectionCard>
            ))}
          {tab === "telegram" && (
            <SectionCard
              title="Group links"
              description="Eight fixed positions, in website order. Each links a group of the Telegram database and shows its current invite link."
              padding="flush"
            >
              {content.telegram.map((card, index, cards) =>
                cardRow({ section: "telegram", card }, index, cards.length)
              )}
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
        ) : editing.section === "telegram" ? (
          <FreshmanTelegramDialog
            key={dialogGeneration}
            open={dialogOpen}
            card={editing.card}
            groups={groups}
            onClose={() => setDialogOpen(false)}
            onSaved={saved}
          />
        ) : (
          <FreshmanCardDialog
            key={dialogGeneration}
            open={dialogOpen}
            card={editing.card}
            onClose={() => setDialogOpen(false)}
            onSaved={saved}
          />
        ))}
    </>
  )
}
