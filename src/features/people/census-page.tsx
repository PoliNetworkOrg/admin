import { useServerFn } from "@tanstack/react-start"
import { Archive, Bell, ClipboardList, FileText, Upload } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  ChipOverflow,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterMenu,
  IconButton,
  RecordHeader,
  RowActions,
  SectionCard,
  SegmentedControl,
  type TableSort,
  Unset,
  useOpenGeneration,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { CensusAnswersDialog } from "./census-answers-dialog"
import { ImportWizard } from "./import-wizard"
import { closeCampaign, sendCensusReminders } from "./people-census.functions"
import {
  activeTeams,
  CENSUS_ANSWER,
  CENSUS_SOURCE,
  formatDay,
  isActiveAdmin,
  isMember,
  NO_ANSWER,
  personName,
  roleLabels,
} from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { PersonCell, StateBadge, TruncatedChip } from "./people-ui"
import type { Campaign, CampaignDetail, CensusEntry, PersonRow } from "./people.contract"

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/** Stacked meter: continuing (success) then leaving (warning) over the expected people. */
function CensusMeter({ campaign, className }: { campaign: Campaign; className?: string }) {
  const { expected, continuing, leaving, noAnswer } = campaign
  return (
    <span
      role="img"
      aria-label={`${continuing} continuing, ${leaving} leaving, ${noAnswer} no answer`}
      className={className ?? "flex h-1.5 w-full overflow-hidden rounded-(--pn-r-full) bg-(--pn-muted)"}
    >
      <span className="bg-(--pn-success-solid)" style={{ width: `${(continuing / (expected || 1)) * 100}%` }} />
      <span className="bg-(--pn-warning-solid)" style={{ width: `${(leaving / (expected || 1)) * 100}%` }} />
    </span>
  )
}

function CampaignStatus({ campaign }: { campaign: Campaign }) {
  return (
    <StateBadge
      state={campaign.status === "open" ? { label: "Open", tone: "brand" } : { label: "Closed", tone: "neutral" }}
    />
  )
}

const campaignColumns: DataTableColumn<Campaign>[] = [
  {
    id: "campaign",
    label: "Campaign",
    fill: true,
    minWidth: 220,
    mobile: "main",
    cell: (campaign) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{campaign.year} census</span>
        <span className="truncate text-xs text-(--pn-fg-muted)">{campaign.source}</span>
      </span>
    ),
  },
  {
    id: "status",
    label: "Status",
    width: 104,
    mobile: "end",
    cell: (campaign) => <CampaignStatus campaign={campaign} />,
  },
  {
    id: "period",
    label: "Period",
    width: 232,
    priority: 4,
    mobile: "meta",
    cell: (campaign) => (
      <span className="whitespace-nowrap">
        {formatDay(campaign.openedOn)} → {formatDay(campaign.closesOn)}
      </span>
    ),
  },
  {
    id: "progress",
    label: "Progress",
    width: 200,
    priority: 3,
    mobile: "hidden",
    cell: (campaign) => (
      <span className="flex items-center gap-2.5">
        <CensusMeter campaign={campaign} />
        <span className="shrink-0 text-xs text-(--pn-fg-muted) tabular-nums">
          {percent(campaign.continuing + campaign.leaving, campaign.expected)}%
        </span>
      </span>
    ),
  },
  {
    id: "expected",
    label: "Expected",
    width: 104,
    align: "end",
    mobile: "meta",
    cell: (campaign) => formatNumber(campaign.expected),
  },
  {
    id: "continuing",
    label: "Continuing",
    width: 112,
    align: "end",
    priority: 2,
    mobile: "hidden",
    cell: (campaign) => formatNumber(campaign.continuing),
  },
  {
    id: "leaving",
    label: "Leaving",
    width: 96,
    align: "end",
    priority: 2,
    mobile: "hidden",
    cell: (campaign) => formatNumber(campaign.leaving),
  },
  {
    id: "noAnswer",
    label: "No answer",
    width: 112,
    align: "end",
    mobile: "hidden",
    cell: (campaign) => formatNumber(campaign.noAnswer),
  },
]

/** People › Census: one row per yearly campaign. */
export function CensusPage({ campaigns }: { campaigns: Campaign[] }) {
  const open = campaigns.find((campaign) => campaign.status === "open")
  return (
    <>
      <PageBar
        description={
          campaigns.length
            ? `${pluralize(campaigns.length, "campaign")}${open ? ` · ${open.year} open until ${formatDay(open.closesOn)}` : ""}`
            : "Yearly confirmation from volunteers and members"
        }
      />
      <PageContent>
        <DataTable
          label="Census campaigns"
          columns={campaignColumns}
          rows={campaigns}
          getRowId={(campaign) => campaign.id}
          rowLabel={(campaign) => `${campaign.year} census`}
          rowHref={(campaign) => `/dashboard/people/census/${campaign.id}`}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No campaigns yet"
              text="Each September a campaign asks volunteers and members whether they're staying on."
            />
          }
        />
      </PageContent>
    </>
  )
}

type Segment = "all" | "answered" | "continuing" | "leaving" | "none"
type RoleFilter = "member" | "admin" | "team"
type CampaignRow = PersonRow & { entry: CensusEntry | undefined }

const SEGMENT_TEST = {
  all: () => true,
  answered: (row: CampaignRow) => !!row.entry?.answer,
  continuing: (row: CampaignRow) => row.entry?.answer === "continues",
  leaving: (row: CampaignRow) => row.entry?.answer === "leaving",
  none: (row: CampaignRow) => !row.entry?.answer,
} satisfies Record<Segment, (row: CampaignRow) => boolean>

const ROLE_TEST = {
  member: (row: CampaignRow) => isMember(row),
  admin: (row: CampaignRow) => isActiveAdmin(row),
  team: (row: CampaignRow) => activeTeams(row).length > 0,
} satisfies Record<RoleFilter, (row: CampaignRow) => boolean>

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

/** People › Census › {year}: who answered, what, and the actions of an open campaign. */
export function CampaignPage({ detail }: { detail: CampaignDetail }) {
  const { campaign } = detail
  const canWrite = useCan("people:write")
  const canRead = useCan("people:read")
  const isOpen = campaign.status === "open"
  const canAct = canWrite && isOpen
  const remind = useServerFn(sendCensusReminders)
  const close = useServerFn(closeCampaign)
  const refresh = useRefreshAfter()
  const all: CampaignRow[] = detail.people.map((person) => ({
    ...person,
    entry: person.census.find((entry) => entry.year === campaign.year),
  }))

  const [segment, setSegment] = useState<Segment>("all")
  const [role, setRole] = useState<RoleFilter | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [confirm, setConfirm] = useState<"remind" | "close" | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const importKey = useOpenGeneration(importOpen)
  const [answers, setAnswers] = useState<CampaignRow | null>(null)
  const [answersOpen, setAnswersOpen] = useState(false)

  const inSegment = all.filter(SEGMENT_TEST[segment])
  const filtered = inSegment.filter(
    (row) =>
      (role === null || ROLE_TEST[role](row)) &&
      (!deferredQuery ||
        [personName(row), row.profile.personalEmail ?? ""].some((value) =>
          value.toLocaleLowerCase().includes(deferredQuery)
        ))
  )
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted(
    (a, b) =>
      (sort.column === "answeredOn"
        ? (a.entry?.answeredOn ?? "").localeCompare(b.entry?.answeredOn ?? "")
        : personName(a).localeCompare(personName(b))) * sign
  )
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const narrowed = deferredQuery !== "" || role !== null
  const unanswered = all.filter(SEGMENT_TEST.none).length
  const answered = campaign.continuing + campaign.leaving

  function ask(kind: "remind" | "close") {
    setConfirm(kind)
    setConfirmOpen(true)
  }

  async function remindOne(row: CampaignRow) {
    try {
      const result = await remind({ data: { campaignId: campaign.id, personId: row.id } })
      await refresh(result.sent ? `Reminder sent to ${personName(row)}.` : `${personName(row)} was reminded recently.`)
    } catch (caught) {
      console.error(caught)
      appToast.error(errorMessage(caught, "Couldn't send the reminder."))
    }
  }

  const columns: DataTableColumn<CampaignRow>[] = [
    {
      id: "name",
      label: "Name",
      sortable: true,
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (row) => <PersonCell name={personName(row)} secondary={row.profile.course} />,
    },
    {
      id: "roles",
      label: "Roles",
      width: 200,
      priority: 3,
      mobile: "hidden",
      cell: (row) => {
        const labels = roleLabels(row)
        return labels.length ? (
          <ChipOverflow
            items={labels}
            itemLabel={(label) => label}
            renderItem={(label) => <TruncatedChip key={label} label={label} />}
          />
        ) : (
          <Unset />
        )
      },
    },
    {
      id: "answer",
      label: "Answer",
      width: 128,
      mobile: "meta",
      cell: (row) => <StateBadge state={row.entry?.answer ? CENSUS_ANSWER[row.entry.answer] : NO_ANSWER} />,
    },
    {
      id: "answeredOn",
      label: "Answered on",
      sortable: true,
      width: 136,
      priority: 4,
      mobile: "meta",
      cell: (row) =>
        row.entry?.answeredOn ? (
          <span className="whitespace-nowrap">{formatDay(row.entry.answeredOn)}</span>
        ) : (
          <Unset />
        ),
    },
    {
      id: "source",
      label: "Source",
      width: 168,
      priority: 4,
      mobile: "hidden",
      cell: (row) => (row.entry?.source ? CENSUS_SOURCE[row.entry.source] : <Unset />),
    },
    {
      id: "reminders",
      label: "Reminders",
      width: 112,
      align: "end",
      priority: 5,
      mobile: "hidden",
      cell: (row) => row.entry?.reminders ?? 0,
    },
  ]

  return (
    <>
      <PageBar
        back={{ label: "census", link: { to: "/dashboard/people/census" } }}
        context={`${campaign.year} census`}
        right={
          canAct ? (
            <>
              {/* Phones keep the full width for Import responses: Send reminders becomes an icon there. */}
              <Button
                size="sm"
                variant="outline"
                className={cn(buttonMotion, "max-shell:hidden")}
                onClick={() => ask("remind")}
              >
                <Bell data-icon="inline-start" />
                Send reminders
              </Button>
              <IconButton
                label="Send reminders"
                icon={Bell}
                appearance="boxed"
                className="size-10 flex-none shell:hidden"
                onClick={() => ask("remind")}
              />
              <Button size="sm" className={buttonMotion} onClick={() => setImportOpen(true)}>
                <Upload data-icon="inline-start" />
                Import responses
              </Button>
              <IconButton
                label="Close campaign"
                icon={Archive}
                appearance="boxed"
                className="size-10 max-shell:flex-none"
                onClick={() => ask("close")}
              />
            </>
          ) : undefined
        }
      />
      <PageContent>
        <div className="flex flex-col gap-6">
          <RecordHeader
            title={`${campaign.year} census`}
            badge={<CampaignStatus campaign={campaign} />}
            meta={campaign.source}
          />
          <SectionCard>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[15px] font-semibold tabular-nums">
                  {formatNumber(answered)} of {formatNumber(campaign.expected)} answered
                  <span className="ml-2 text-[13px] font-normal text-(--pn-fg-muted)">
                    {percent(answered, campaign.expected)}%
                  </span>
                </span>
                <span className="text-[13px] text-(--pn-fg-muted)">
                  {isOpen ? "Closes" : "Closed"} {formatDay(campaign.closesOn)}
                </span>
              </div>
              <CensusMeter
                campaign={campaign}
                className="flex h-2 w-full overflow-hidden rounded-(--pn-r-full) bg-(--pn-muted)"
              />
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-(--pn-fg-muted)">
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-(--pn-success-solid)" />
                  {formatNumber(campaign.continuing)} continuing
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-(--pn-warning-solid)" />
                  {formatNumber(campaign.leaving)} leaving
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-(--pn-muted) ring-1 ring-(--pn-line-strong)" />
                  {formatNumber(campaign.noAnswer)} no answer
                </li>
              </ul>
            </div>
          </SectionCard>
          <Toolbar
            search={{
              value: query,
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: "Search by name or email…",
            }}
            filters={
              <>
                <SegmentedControl<Segment>
                  className="max-shell:hidden"
                  label="Answer"
                  items={[
                    { value: "all", label: "Expected", count: all.length },
                    { value: "answered", label: "Answered", count: all.filter(SEGMENT_TEST.answered).length },
                    { value: "continuing", label: "Continuing", count: all.filter(SEGMENT_TEST.continuing).length },
                    { value: "leaving", label: "Leaving", count: all.filter(SEGMENT_TEST.leaving).length },
                    { value: "none", label: "No answer", count: unanswered },
                  ]}
                  value={segment}
                  onValueChange={(next) => {
                    setSegment(next)
                    setPage(1)
                  }}
                />
                <span className="shell:hidden">
                  <FilterMenu<Segment>
                    label="Answer"
                    allLabel={`Expected · ${all.length}`}
                    value={segment === "all" ? null : segment}
                    onChange={(next) => {
                      setSegment(next ?? "all")
                      setPage(1)
                    }}
                    options={[
                      { value: "answered", label: "Answered", count: all.filter(SEGMENT_TEST.answered).length },
                      { value: "continuing", label: "Continuing", count: all.filter(SEGMENT_TEST.continuing).length },
                      { value: "leaving", label: "Leaving", count: all.filter(SEGMENT_TEST.leaving).length },
                      { value: "none", label: "No answer", count: unanswered },
                    ]}
                  />
                </span>
                <FilterMenu<RoleFilter>
                  label="Role"
                  allLabel="All roles"
                  value={role}
                  onChange={(value) => {
                    setRole(value)
                    setPage(1)
                  }}
                  options={[
                    { value: "member", label: "Member" },
                    { value: "admin", label: "Admin" },
                    { value: "team", label: "Team member" },
                  ]}
                />
              </>
            }
            count={
              narrowed ? (
                <Count value={filtered.length} total={inSegment.length} noun="person" plural="people" />
              ) : undefined
            }
          />
          <DataTable
            label={`${campaign.year} census answers`}
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            rowLabel={personName}
            rowHref={(row) => `/dashboard/people/${row.id}`}
            sort={sort}
            onSort={(next) => {
              setSort(next)
              setPage(1)
            }}
            actions={
              canAct || canRead
                ? (row) => (
                    <RowActions>
                      {/* Answered rows open the answers; the others can be reminded while the campaign is open. */}
                      {!row.entry?.answer && canAct ? (
                        <IconButton
                          label="Send reminder"
                          ariaLabel={`Send reminder to ${personName(row)}`}
                          icon={Bell}
                          onClick={() => remindOne(row)}
                        />
                      ) : row.entry?.answer && canRead ? (
                        <IconButton
                          label="View answers"
                          ariaLabel={`View the answers of ${personName(row)}`}
                          icon={FileText}
                          onClick={() => {
                            setAnswers(row)
                            setAnswersOpen(true)
                          }}
                        />
                      ) : (
                        <span aria-hidden className="size-9 shrink-0" />
                      )}
                    </RowActions>
                  )
                : undefined
            }
            actionsWidth={60}
            pagination={{
              page,
              pageSize,
              total: sorted.length,
              onPage: setPage,
              onPageSize: (size) => {
                setPageSize(size)
                setPage(1)
              },
            }}
            empty={
              narrowed ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No people match"
                  text="Try another search or remove the role filter."
                  action={
                    <Button
                      size="sm"
                      variant="ghost"
                      className={buttonMotion}
                      onClick={() => {
                        setQuery("")
                        setRole(null)
                        setPage(1)
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title="Nobody here"
                  text="No one in this campaign matches this answer."
                />
              )
            }
          />
        </div>
      </PageContent>

      {canAct && confirm === "remind" ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          tone="primary"
          icon={Bell}
          title="Send reminders?"
          description={`${pluralize(unanswered, "person")} ${unanswered === 1 ? "hasn't" : "haven't"} answered. Each gets an email and a Telegram message with their personal link; people reminded in the last 3 days are skipped.`}
          confirmLabel="Send reminders"
          onConfirm={async () => {
            const result = await remind({ data: { campaignId: campaign.id, personId: null } })
            await refresh(
              `${pluralize(result.sent, "reminder")} sent${result.skipped ? `, ${result.skipped} skipped (reminded in the last 3 days)` : ""}.`
            )
          }}
        />
      ) : null}
      {canAct && confirm === "close" ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          tone="primary"
          icon={Archive}
          title={`Close ${campaign.year} census?`}
          description={`${pluralize(unanswered, "person")} without an answer keep their roles and are marked "No answer". Answers can't be added after closing.`}
          confirmLabel="Close campaign"
          onConfirm={async () => {
            await close({ data: { campaignId: campaign.id } })
            await refresh("Campaign closed.")
          }}
        />
      ) : null}
      {canAct ? (
        <ImportWizard key={`import-${importKey}`} open={importOpen} onOpenChange={setImportOpen} campaign={campaign} />
      ) : null}
      {answers && canRead ? (
        <CensusAnswersDialog
          key={answers.id}
          open={answersOpen}
          onOpenChange={setAnswersOpen}
          personId={answers.id}
          name={personName(answers)}
          year={campaign.year}
        />
      ) : null}
    </>
  )
}
