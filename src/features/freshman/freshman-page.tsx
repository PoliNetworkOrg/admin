import {
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpen,
  ChartNoAxesColumn,
  Folder,
  Home,
  Map,
  Monitor,
  Pencil,
  Radio,
  RefreshCw,
  Repeat,
  ShoppingCart,
  DollarSign,
  UserCheck,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"

import {
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  IconButton,
  InlineAlert,
  SectionCard,
  SegmentedControl,
  TableSkeleton,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GuidesPage } from "@/features/guides/guides-page"
import type { Guide } from "@/features/guides/types"

import {
  freshmanApi,
  freshmanCardInput,
  freshmanIconInput,
  type FreshmanCard,
  type FreshmanCardInput,
  type FreshmanContent,
} from "./freshman.api"
import { freshmanFaqCatalog } from "./freshman.data"

const icons = {
  chart: ChartNoAxesColumn,
  monitor: Monitor,
  book: BookOpen,
  map: Map,
  news: Radio,
  money: DollarSign,
  folder: Folder,
  repeat: Repeat,
  refresh: RefreshCw,
  bell: Bell,
  user: UserCheck,
  users: Users,
  cart: ShoppingCart,
  home: Home,
}
const groups = [
  { id: "featured", title: "In evidenza" },
  { id: "guides", title: "Guide e Utility" },
  { id: "materials", title: "Materiali" },
  { id: "tools", title: "Tech Tools" },
]
const tabs = [
  { value: "resources", label: "Resources" },
  { value: "telegram", label: "Telegram Hub" },
  { value: "faqs", label: "FAQs" },
  { value: "guide", label: "Guide" },
] as const

export type FreshmanTab = (typeof tabs)[number]["value"]
type Editing =
  | { section: "resources" | "telegram"; card: FreshmanCard }
  | { section: "faqs"; index: number; faqId: string }

export function FreshmanPage({
  tab,
  onTabChange,
  guides,
}: {
  tab: FreshmanTab
  onTabChange: (tab: FreshmanTab) => void
  guides: Guide[] | null
}) {
  const canWrite = useCan("web:content:write")
  const [content, setContent] = useState<FreshmanContent | null>(null)
  const [loadError, setLoadError] = useState(false)
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
          setLoadError(false)
        }
      })
      .catch((error) => {
        console.error(error)
        if (!ignore) setLoadError(true)
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

  async function move(section: "resources" | "telegram", id: string, direction: -1 | 1) {
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

  function cardRows(section: "resources" | "telegram", cards: FreshmanCard[]) {
    return cards.map((card, index) => {
      const Icon = icons[card.icon]
      return (
        <div key={card.id} className="flex items-start gap-3 border-b border-(--pn-line) p-4 last:border-0">
          <Icon aria-hidden className="mt-1 size-5 shrink-0 text-(--pn-fg-muted)" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium break-words text-(--pn-fg)">{card.title}</h3>
            {card.description && <p className="mt-1 text-[13px] text-(--pn-fg-muted)">{card.description}</p>}
            <p className="mt-1 break-all text-xs text-(--pn-fg-muted)">{card.href || "No destination set"}</p>
          </div>
          {canWrite && (
            <div className="flex shrink-0 flex-wrap justify-end gap-0.5 max-shell:max-w-18">
              <IconButton
                label="Move up"
                ariaLabel={`Move ${card.title} up`}
                icon={ArrowUp}
                disabled={moving || index === 0}
                onClick={() => void move(section, card.id, -1)}
              />
              <IconButton
                label="Move down"
                ariaLabel={`Move ${card.title} down`}
                icon={ArrowDown}
                disabled={moving || index === cards.length - 1}
                onClick={() => void move(section, card.id, 1)}
              />
              <IconButton
                label="Edit"
                ariaLabel={`Edit ${card.title}`}
                icon={Pencil}
                disabled={moving}
                onClick={() => setEditing({ section, card })}
              />
            </div>
          )}
        </div>
      )
    })
  }

  const navigation = (
    <Toolbar
      lead={<SegmentedControl label="Freshman content" items={tabs} value={tab} onValueChange={onTabChange} />}
    />
  )
  if (tab === "guide") return <GuidesPage guides={guides ?? []} navigation={navigation} />

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
            <InlineAlert
              action={
                <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
                  Retry
                </Button>
              }
            >
              Demo content could not be loaded. Browser storage may be unavailable or contain invalid data.
            </InlineAlert>
          ) : !content ? (
            <TableSkeleton columns={3} rows={5} label="Loading freshman content…" />
          ) : (
            <>
              {tab === "resources" &&
                groups.map((group) => (
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
      {editing &&
        canWrite &&
        (editing.section === "faqs" ? (
          <FaqDialog index={editing.index} initialId={editing.faqId} onClose={() => setEditing(null)} onSaved={saved} />
        ) : (
          <CardDialog card={editing.card} section={editing.section} onClose={() => setEditing(null)} onSaved={saved} />
        ))}
    </>
  )
}

function CardDialog({
  card,
  section,
  onClose,
  onSaved,
}: {
  card: FreshmanCard
  section: "resources" | "telegram"
  onClose: () => void
  onSaved: (content: FreshmanContent) => void
}) {
  const initial: FreshmanCardInput = {
    title: card.title,
    description: card.description,
    href: card.href,
    icon: card.icon,
  }
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof FreshmanCardInput, string>>>({})
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)

  async function submit() {
    const parsed = freshmanCardInput.safeParse(values)
    const nextErrors: Partial<Record<keyof FreshmanCardInput, string>> = {}
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === "title" || field === "description" || field === "href" || field === "icon")
          nextErrors[field] = issue.message
      }
    if (section === "telegram" && !values.href.trim()) nextErrors.href = "Enter a group link."
    setErrors(nextErrors)
    if (!parsed.success || Object.keys(nextErrors).length) {
      const firstInvalid = Object.keys(nextErrors)[0]
      if (firstInvalid) document.getElementById(`freshman-${firstInvalid}`)?.focus()
      return
    }
    onSaved(await freshmanApi.updateCard(section, card.id, parsed.data))
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Edit ${card.title}`}
      description="Update this fixed position in the demo page."
      noun="card"
      dirty={dirty}
      submitLabel="Save demo changes"
      canSubmit={dirty}
      onSubmit={submit}
    >
      <FormField label="Title" htmlFor="freshman-title" error={errors.title}>
        <Input
          id="freshman-title"
          value={values.title}
          maxLength={120}
          aria-invalid={!!errors.title}
          aria-describedby={fieldHintId("freshman-title")}
          className={fieldControl}
          onChange={(event) => setValues({ ...values, title: event.target.value })}
        />
      </FormField>
      {section === "resources" && (
        <FormField label="Description" htmlFor="freshman-description" optional error={errors.description}>
          <Textarea
            id="freshman-description"
            value={values.description}
            maxLength={1000}
            aria-invalid={!!errors.description}
            aria-describedby={fieldHintId("freshman-description")}
            className={fieldControl}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
        </FormField>
      )}
      <FormField
        label="Destination"
        htmlFor="freshman-href"
        optional={section === "resources"}
        error={errors.href}
        hint="A site path such as /materials, or a full https:// URL. An empty resource has no link."
      >
        <Input
          id="freshman-href"
          value={values.href}
          maxLength={2048}
          aria-invalid={!!errors.href}
          aria-describedby={fieldHintId("freshman-href")}
          className={fieldControl}
          onChange={(event) => setValues({ ...values, href: event.target.value })}
        />
      </FormField>
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Icon</legend>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
          {Object.entries(icons).map(([name, Icon]) => (
            <IconButton
              key={name}
              label={name}
              icon={Icon}
              appearance="boxed"
              aria-pressed={values.icon === name}
              tone={values.icon === name ? "info" : "default"}
              onClick={() => {
                const selected = freshmanIconInput.parse(name)
                setValues({ ...values, icon: selected })
              }}
            />
          ))}
        </div>
      </fieldset>
    </FormDialog>
  )
}

function FaqDialog({
  index,
  initialId,
  onClose,
  onSaved,
}: {
  index: number
  initialId: string
  onClose: () => void
  onSaved: (content: FreshmanContent) => void
}) {
  const [id, setId] = useState(initialId)
  const selected = freshmanFaqCatalog.find((faq) => faq.id === id)!
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`FAQ position ${index + 1}`}
      description="Choose a question from the demo catalog. Questions and answers will come from the existing FAQ management when the API is connected."
      noun="FAQ selection"
      dirty={id !== initialId}
      submitLabel="Save demo changes"
      canSubmit={id !== initialId}
      onSubmit={async () => onSaved(await freshmanApi.selectFaq(index, id))}
    >
      <FormField label="Question" htmlFor="freshman-faq">
        <select
          id="freshman-faq"
          value={id}
          onChange={(event) => setId(event.target.value)}
          className={`${fieldControl} h-10 w-full rounded-md border px-3`}
        >
          {freshmanFaqCatalog.map((faq) => (
            <option key={faq.id} value={faq.id}>
              {faq.question}
            </option>
          ))}
        </select>
      </FormField>
      <p className="text-[13px] text-(--pn-fg-muted)">{selected.answer}</p>
    </FormDialog>
  )
}
