import { useServerFn } from "@tanstack/react-start"
import { Check, ChevronLeft, ChevronRight, FileSpreadsheet, Send, UserPlus, Users } from "lucide-react"
import { type ReactNode, useState } from "react"

import {
  buttonMotion,
  FileButton,
  FormDialog,
  FormField,
  IconButton,
  InlineAlert,
  PlatformGlyph,
  SegmentedControl,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { formatNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { commitCensusImport, previewCensusImport } from "./people-census.functions"
import { CENSUS_ANSWER } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { RadioCard, StateBadge } from "./people-ui"
import { type Campaign, IMPORT_TABS, type ImportPreview, type ImportTab } from "./people.contract"

type Step = "upload" | "review" | "duplicates" | "telegram" | "confirm"
type Choice = "same" | "different"

const STEP_LABELS = {
  upload: "Upload",
  review: "Review",
  duplicates: "Duplicates",
  telegram: "Telegram",
  confirm: "Confirm",
} satisfies Record<Step, string>

const TAB_LABELS = {
  newPeople: "New people",
  updates: "Updates",
  duplicates: "Possible duplicates",
  invalid: "Invalid rows",
  discrepancies: "Discrepancies",
  alreadyImported: "Already imported",
} satisfies Record<ImportTab, string>

const DETAIL_LABELS = {
  newPeople: "From the form",
  updates: "Changes",
  duplicates: "Matches",
  invalid: "Problem",
  discrepancies: "Discrepancy",
  alreadyImported: "Imported",
} satisfies Record<ImportTab, string>

/** Steps without work are skipped: no pairs, no Duplicates; no usernames to match, no Telegram. */
function stepsFor(preview: ImportPreview | null): Step[] {
  return [
    "upload",
    "review",
    ...(preview && preview.duplicates.length === 0 ? [] : ["duplicates" as const]),
    ...(preview && preview.telegram.length === 0 ? [] : ["telegram" as const]),
    "confirm",
  ]
}

function Stepper({ steps, current }: { steps: Step[]; current: Step }) {
  const index = steps.indexOf(current)
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {steps.map((step, position) => {
        const done = position < index
        const active = position === index
        return (
          <li key={step} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            {position > 0 ? <span aria-hidden className="h-px w-4 bg-(--pn-line-strong)" /> : null}
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums",
                active && "border-(--pn-accent-solid) bg-(--pn-accent-solid) text-(--pn-accent-solid-fg)",
                done && "border-(--pn-accent) text-(--pn-accent)",
                !active && !done && "border-(--pn-line-strong) text-(--pn-fg-muted)"
              )}
            >
              {done ? <Check aria-hidden className="size-3" strokeWidth={2.5} /> : position + 1}
            </span>
            <span className={cn("text-[13px]", active ? "font-medium text-(--pn-fg)" : "text-(--pn-fg-muted)")}>
              {STEP_LABELS[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-(--pn-r-4) border border-(--pn-line) px-3 py-2.5">
      <span className="text-[18px] font-semibold tabular-nums">{formatNumber(value)}</span>
      <span className="text-xs text-(--pn-fg-muted)">{label}</span>
    </div>
  )
}

function SummaryRow({ icon: Icon, title, meta }: { icon: typeof Users; title: ReactNode; meta?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-(--pn-r-3) bg-(--pn-muted) text-(--pn-fg-muted)">
        <Icon aria-hidden strokeWidth={1.75} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-medium">{title}</span>
        {meta ? <span className="text-xs text-(--pn-fg-muted)">{meta}</span> : null}
      </span>
    </li>
  )
}

/**
 * Import responses: upload the Forms export, review what the backend parsed, settle possible duplicates and Telegram
 * matches, then confirm. Nothing is saved before the last step.
 */
export function ImportWizard({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: Campaign
}) {
  const upload = useServerFn(previewCensusImport)
  const commit = useServerFn(commitCensusImport)
  const refresh = useRefreshAfter()
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | undefined>()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [tab, setTab] = useState<ImportTab>("newPeople")
  const [pair, setPair] = useState(0)
  const [duplicates, setDuplicates] = useState<Record<string, Choice>>({})
  const [telegram, setTelegram] = useState<Record<string, string | null>>({})

  const steps = stepsFor(preview)
  const index = steps.indexOf(step)
  const unresolved = preview ? preview.duplicates.filter((item) => !duplicates[item.pairId]).length : 0

  function go(offset: number) {
    const next = steps[index + offset]
    if (next) setStep(next)
  }

  async function submit() {
    if (step === "upload") {
      if (!file) {
        setFileError("Choose the Forms export.")
        return
      }
      const form = new FormData()
      form.set("campaignId", campaign.id)
      form.set("file", file)
      let result: ImportPreview
      try {
        result = await upload({ data: form })
      } catch (caught) {
        console.error(caught)
        const fallback = "The file couldn't be read. Check it's the Forms export and try again."
        throw new Error(caught instanceof Error ? errorMessage(caught, fallback) : fallback, { cause: caught })
      }
      setPreview(result)
      setDuplicates({})
      setTelegram({})
      setPair(0)
      setTab(IMPORT_TABS.find((candidate) => result.counts[candidate] > 0) ?? "newPeople")
      setStep("review")
      return
    }
    if (step === "duplicates" && unresolved > 0) {
      throw new Error(`Decide on ${pluralize(unresolved, "remaining pair")} before going on.`)
    }
    if (step !== "confirm") {
      go(1)
      return
    }
    if (!preview) return
    let imported: number
    try {
      const result = await commit({ data: { importId: preview.importId, duplicates, telegram } })
      imported = result.imported
    } catch (caught) {
      console.error(caught)
      const fallback = "The responses couldn't be imported. Nothing was saved; try again."
      throw new Error(caught instanceof Error ? errorMessage(caught, fallback) : fallback, { cause: caught })
    }
    await refresh(`${pluralize(imported, "row")} imported.`)
    onOpenChange(false)
  }

  const importable = preview ? preview.rows - preview.counts.invalid - preview.counts.alreadyImported : 0

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Import responses"
      description={`Bring the ${campaign.year} answers from the Microsoft Forms export into People.`}
      noun="import"
      dirty={file !== null}
      submitLabel={
        step === "upload"
          ? "Upload and review"
          : step === "confirm"
            ? `Import ${pluralize(importable, "row")}`
            : "Continue"
      }
      submitOnEnter={false}
      onSubmit={submit}
      footerStart={
        index > 0 ? (
          <Button type="button" variant="ghost" className={buttonMotion} onClick={() => go(-1)}>
            <ChevronLeft data-icon="inline-start" />
            Back
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <Stepper steps={steps} current={step} />

        {step === "upload" ? (
          <FormField label="Forms export" htmlFor="import-file" error={fileError}>
            <div className="flex flex-col items-center gap-2 rounded-(--pn-r-5) border border-dashed border-(--pn-line-strong) px-4 py-8 text-center">
              <FileSpreadsheet aria-hidden className="size-6 text-(--pn-fg-muted)" strokeWidth={1.5} />
              <span className="text-[14px] font-medium">Upload the Forms export</span>
              <span className="text-[13px] text-(--pn-fg-muted)">
                .xlsx or .csv, as downloaded from Microsoft Forms › Open in Excel. Up to 10 MB.
              </span>
              <FileButton
                id="import-file"
                file={file}
                onChange={(next) => {
                  setFile(next)
                  setFileError(undefined)
                  setPreview(null)
                }}
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                invalid={!!fileError}
                className="mt-2 items-center"
              />
            </div>
          </FormField>
        ) : null}

        {step === "review" && preview ? (
          <>
            <div className="grid grid-cols-2 gap-2 shell:grid-cols-3">
              <Stat value={preview.rows} label="Rows in file" />
              <Stat value={preview.counts.newPeople} label="New people" />
              <Stat value={preview.counts.updates} label="Updates" />
              <Stat value={preview.counts.duplicates} label="Possible duplicates" />
              <Stat value={preview.counts.invalid} label="Invalid rows" />
              {preview.counts.alreadyImported ? (
                <Stat value={preview.counts.alreadyImported} label="Already imported" />
              ) : (
                <Stat value={preview.counts.discrepancies} label="Discrepancies" />
              )}
            </div>
            {preview.counts.invalid ? (
              <InlineAlert tone="danger">
                {pluralize(preview.counts.invalid, "row")} can't be imported and are skipped. Fix them in the
                spreadsheet and import the file again; rows already imported are skipped then.
              </InlineAlert>
            ) : null}
            {preview.counts.alreadyImported ? (
              <InlineAlert tone="info">
                This export was imported before. {formatNumber(preview.counts.alreadyImported)} rows are already
                imported and are skipped; only the {formatNumber(importable)} new or changed rows are imported.
              </InlineAlert>
            ) : null}
            <SegmentedControl<ImportTab>
              label="Preview"
              items={IMPORT_TABS.filter((item) => item !== "alreadyImported" || preview.counts.alreadyImported > 0).map(
                (item) => ({ value: item, label: TAB_LABELS[item], count: preview.counts[item] })
              )}
              value={tab}
              onValueChange={setTab}
              className="max-w-full overflow-x-auto"
            />
            <div className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line)">
              <table className="w-full table-fixed text-[13px]">
                <caption className="sr-only">{TAB_LABELS[tab]}</caption>
                <thead className="bg-(--pn-muted) text-left text-xs text-(--pn-fg-muted)">
                  <tr>
                    <th scope="col" className="w-16 px-3 py-2 font-medium">
                      Row
                    </th>
                    <th scope="col" className="w-[34%] px-3 py-2 font-medium">
                      Person
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {DETAIL_LABELS[tab]}
                    </th>
                    <th scope="col" className="w-28 px-3 py-2 font-medium max-shell:hidden">
                      Answer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--pn-line)">
                  {preview.tabs[tab].length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-(--pn-fg-muted)">
                        Nothing in this group.
                      </td>
                    </tr>
                  ) : (
                    preview.tabs[tab].map((row) => (
                      <tr key={row.row} className="align-top">
                        <td className="px-3 py-2 font-mono tabular-nums">#{row.row}</td>
                        <td className="px-3 py-2 font-medium [overflow-wrap:anywhere]">{row.name}</td>
                        <td className="px-3 py-2 [overflow-wrap:anywhere]">{row.detail}</td>
                        <td className="px-3 py-2 max-shell:hidden">
                          {row.answer ? <StateBadge state={CENSUS_ANSWER[row.answer]} /> : <Unset />}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {preview.tabs[tab].length < preview.counts[tab] ? (
              <p className="text-[13px] text-(--pn-fg-muted)">
                Showing {preview.tabs[tab].length} of {formatNumber(preview.counts[tab])} rows.
              </p>
            ) : null}
          </>
        ) : null}

        {step === "duplicates" && preview ? duplicatePairs() : null}

        {step === "telegram" && preview ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-[13px] text-(--pn-fg-muted)">
                Usernames from the form matched to Telegram users the bot knows. Confirm the ones you recognise; the
                rest stay unlinked.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={buttonMotion}
                onClick={() =>
                  setTelegram(
                    Object.fromEntries(
                      preview.telegram.map((row) => [row.rowId, row.suggestion ? row.suggestion.telegramId : null])
                    )
                  )
                }
              >
                <Check data-icon="inline-start" />
                Confirm all
              </Button>
            </div>
            <ul className="divide-y divide-(--pn-line) rounded-(--pn-r-4) border border-(--pn-line)">
              {preview.telegram.map((row) => {
                const decided = Object.hasOwn(telegram, row.rowId)
                const confirmed = decided && telegram[row.rowId] !== null
                return (
                  <li key={row.rowId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[14px] font-medium">{row.name}</span>
                        <span className="font-mono text-xs text-(--pn-fg-muted)">@{row.username}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-(--pn-fg-muted)">
                        {row.suggestion ? (
                          <>
                            <PlatformGlyph platform="tg" className="size-3" />
                            {row.suggestion.name} · {row.suggestion.info}
                          </>
                        ) : (
                          "No Telegram user with this username yet"
                        )}
                      </span>
                    </span>
                    {decided ? (
                      <span className="flex items-center gap-2">
                        <StatusBadge tone={confirmed ? "success" : "neutral"}>
                          {confirmed ? "Confirmed" : "Skipped"}
                        </StatusBadge>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={buttonMotion}
                          onClick={() =>
                            setTelegram((current) => {
                              const next = { ...current }
                              delete next[row.rowId]
                              return next
                            })
                          }
                        >
                          Undo
                        </Button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={buttonMotion}
                          onClick={() => setTelegram((current) => ({ ...current, [row.rowId]: null }))}
                        >
                          Skip
                        </Button>
                        {row.suggestion ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={buttonMotion}
                            onClick={() =>
                              setTelegram((current) => ({
                                ...current,
                                [row.rowId]: row.suggestion?.telegramId ?? null,
                              }))
                            }
                          >
                            Confirm
                          </Button>
                        ) : null}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}

        {step === "confirm" && preview ? (
          <>
            <ul className="divide-y divide-(--pn-line) rounded-(--pn-r-4) border border-(--pn-line)">
              <SummaryRow
                icon={UserPlus}
                title={`${formatNumber(preview.counts.newPeople)} new ${preview.counts.newPeople === 1 ? "person" : "people"} added`}
                meta="Each gets a record with this year's answer."
              />
              <SummaryRow
                icon={Users}
                title={`${pluralize(preview.counts.updates, "record")} updated`}
                meta={`${pluralize(preview.counts.leaving, "person")} answered No; their roles end with the reason given.`}
              />
              {preview.duplicates.length ? (
                <SummaryRow
                  icon={Users}
                  title={`${pluralize(preview.duplicates.length, "possible duplicate")} settled`}
                  meta={`${Object.values(duplicates).filter((choice) => choice === "same").length} merged into existing records, ${Object.values(duplicates).filter((choice) => choice === "different").length} added as new people.`}
                />
              ) : null}
              {preview.telegram.length ? (
                <SummaryRow
                  icon={Send}
                  title={`${pluralize(Object.values(telegram).filter((value) => value !== null).length, "Telegram account")} linked`}
                  meta={`${preview.telegram.length - Object.values(telegram).filter((value) => value !== null).length} left unlinked.`}
                />
              ) : null}
              {preview.counts.invalid || preview.counts.alreadyImported ? (
                <SummaryRow
                  icon={FileSpreadsheet}
                  title={`${pluralize(preview.counts.invalid + preview.counts.alreadyImported, "row")} skipped`}
                  meta={[
                    preview.counts.invalid ? `${preview.counts.invalid} invalid` : null,
                    preview.counts.alreadyImported ? `${preview.counts.alreadyImported} already imported` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : null}
            </ul>
            <InlineAlert tone="info">
              Nothing is deleted. Records gain this year's answers; a "No" ends that role with the reason given, and its
              history stays.
            </InlineAlert>
          </>
        ) : null}
      </div>
    </FormDialog>
  )

  function duplicatePairs() {
    if (!preview) return null
    const item = preview.duplicates[pair]
    if (!item) return null
    const choice = duplicates[item.pairId]
    const sides = [
      { heading: `In the file · row ${item.row}`, value: (field: (typeof item.fields)[number]) => field.file },
      { heading: `On record ${item.recordId}`, value: (field: (typeof item.fields)[number]) => field.record },
    ]
    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] font-medium">
            Pair {pair + 1} of {preview.duplicates.length}
            {unresolved ? (
              <span className="ml-2 text-[13px] font-normal text-(--pn-fg-muted)">{unresolved} left</span>
            ) : null}
          </span>
          <span className="flex gap-1">
            <IconButton
              type="button"
              label="Previous pair"
              appearance="boxed"
              icon={ChevronLeft}
              disabled={pair === 0}
              onClick={() => setPair((value) => value - 1)}
            />
            <IconButton
              type="button"
              label="Next pair"
              appearance="boxed"
              icon={ChevronRight}
              disabled={pair === preview.duplicates.length - 1}
              onClick={() => setPair((value) => value + 1)}
            />
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 shell:grid-cols-2">
          {sides.map((side) => (
            <div key={side.heading} className="rounded-(--pn-r-4) border border-(--pn-line) p-3">
              <h3 className="mb-2 text-xs font-medium text-(--pn-fg-muted)">{side.heading}</h3>
              <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                {item.fields.map((field) => {
                  const differs = field.file !== field.record
                  return (
                    <div key={field.label} className="contents">
                      <dt className="text-(--pn-fg-muted)">{field.label}</dt>
                      <dd className={cn("[overflow-wrap:anywhere]", field.mono && "font-mono")}>
                        {differs ? (
                          <mark className="rounded-(--pn-r-1) bg-(--pn-warning-bg) px-1 text-(--pn-warning-fg)">
                            {side.value(field)}
                          </mark>
                        ) : (
                          side.value(field)
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}
        </div>
        <p className="text-[13px] text-(--pn-fg-muted)">Highlighted values differ.</p>
        <fieldset className="grid grid-cols-1 gap-2 shell:grid-cols-2">
          <legend className="sr-only">Same person or different people</legend>
          <RadioCard
            name={`pair-${item.pairId}`}
            value="same"
            checked={choice === "same"}
            onSelect={() => {
              setDuplicates((current) => ({ ...current, [item.pairId]: "same" }))
              if (pair < preview.duplicates.length - 1) setPair(pair + 1)
            }}
            label="Same person"
            description={`The answer goes on ${item.recordId}; the file's values update the record.`}
          />
          <RadioCard
            name={`pair-${item.pairId}`}
            value="different"
            checked={choice === "different"}
            onSelect={() => {
              setDuplicates((current) => ({ ...current, [item.pairId]: "different" }))
              if (pair < preview.duplicates.length - 1) setPair(pair + 1)
            }}
            label="Different people"
            description="The row is added as a new person."
          />
        </fieldset>
      </>
    )
  }
}
