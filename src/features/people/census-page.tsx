import { Archive, Bell, ClipboardList, FileText, Upload } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  ChipOverflow,
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
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { MockupBanner } from "./mockup-banner"
import {
  MOCK_CAMPAIGNS,
  MOCK_CENSUS_ANSWER,
  MOCK_CENSUS_SOURCE,
  MOCK_NO_ANSWER,
  type MockCampaign,
  type MockCampaignRow,
} from "./mockup-data"
import { formatDay } from "./people-format"
import { PersonCell, StateBadge, TruncatedChip } from "./people-ui"

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

/** Stacked meter: continuing (success) then leaving (warning) over the expected people. */
function CensusMeter({ campaign, className }: { campaign: MockCampaign; className?: string }) {
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

function CampaignStatus({ campaign }: { campaign: MockCampaign }) {
  return (
    <StateBadge
      state={campaign.status === "open" ? { label: "Open", tone: "brand" } : { label: "Closed", tone: "neutral" }}
    />
  )
}

const campaignColumns: DataTableColumn<MockCampaign>[] = [
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

/**
 * People › Census: an unconnected mockup with one row per sample yearly campaign, kept to be reworked in Phase 3
 * (#145). It reads nothing from the backend.
 */
export function CensusPage() {
  const campaigns = MOCK_CAMPAIGNS
  const open = campaigns.find((campaign) => campaign.status === "open")
  return (
    <>
      <PageBar
        description={`${pluralize(campaigns.length, "campaign")}${open ? ` · ${open.year} open until ${formatDay(open.closesOn)}` : ""}`}
      />
      <PageContent>
        <div className="flex flex-col gap-4">
          <MockupBanner phase={3} />
          <DataTable
            label="Census campaigns (mockup)"
            columns={campaignColumns}
            rows={[...campaigns]}
            getRowId={(campaign) => campaign.id}
            rowLabel={(campaign) => `${campaign.year} census`}
            rowHref={(campaign) => `/dashboard/people/census/${encodeURIComponent(campaign.id)}`}
            empty={
              <EmptyState icon={ClipboardList} title="No campaigns yet" text="The mockup has no sample campaigns." />
            }
          />
        </div>
      </PageContent>
    </>
  )
}

type Segment = "all" | "answered" | "continuing" | "leaving" | "none"
type RoleFilter = "member" | "admin" | "team"

const SEGMENT_TEST = {
  all: () => true,
  answered: (row: MockCampaignRow) => row.answer !== null,
  continuing: (row: MockCampaignRow) => row.answer === "continues",
  leaving: (row: MockCampaignRow) => row.answer === "leaving",
  none: (row: MockCampaignRow) => row.answer === null,
} satisfies Record<Segment, (row: MockCampaignRow) => boolean>

const ROLE_TEST = {
  member: (row: MockCampaignRow) => row.roles.includes("Member"),
  admin: (row: MockCampaignRow) => row.roles.includes("Admin"),
  team: (row: MockCampaignRow) => row.roles.some((role) => role !== "Member" && role !== "Admin"),
} satisfies Record<RoleFilter, (row: MockCampaignRow) => boolean>

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

const columns: DataTableColumn<MockCampaignRow>[] = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 220,
    mobile: "main",
    cell: (row) => <PersonCell name={row.name} secondary={row.course} />,
  },
  {
    id: "roles",
    label: "Roles",
    width: 200,
    priority: 3,
    mobile: "hidden",
    cell: (row) =>
      row.roles.length ? (
        <ChipOverflow
          items={row.roles}
          itemLabel={(label) => label}
          renderItem={(label) => <TruncatedChip key={label} label={label} />}
        />
      ) : (
        <Unset />
      ),
  },
  {
    id: "answer",
    label: "Answer",
    width: 128,
    mobile: "meta",
    cell: (row) => <StateBadge state={row.answer ? MOCK_CENSUS_ANSWER[row.answer] : MOCK_NO_ANSWER} />,
  },
  {
    id: "answeredOn",
    label: "Answered on",
    sortable: true,
    width: 136,
    priority: 4,
    mobile: "meta",
    cell: (row) =>
      row.answeredOn ? <span className="whitespace-nowrap">{formatDay(row.answeredOn)}</span> : <Unset />,
  },
  {
    id: "source",
    label: "Source",
    width: 168,
    priority: 4,
    mobile: "hidden",
    cell: (row) => (row.source ? MOCK_CENSUS_SOURCE[row.source] : <Unset />),
  },
  {
    id: "reminders",
    label: "Reminders",
    width: 112,
    align: "end",
    priority: 5,
    mobile: "hidden",
    cell: (row) => row.reminders,
  },
]

/**
 * People › Census › {year}: an unconnected mockup of who answered a sample campaign and what, kept to be reworked in
 * Phase 3 (#145). Search, filters and sorting work on the sample rows; every action is disabled.
 */
export function CampaignPage({ detail }: { detail: { campaign: MockCampaign; people: readonly MockCampaignRow[] } }) {
  const { campaign, people: all } = detail
  const isOpen = campaign.status === "open"

  const [segment, setSegment] = useState<Segment>("all")
  const [role, setRole] = useState<RoleFilter | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const inSegment = all.filter(SEGMENT_TEST[segment])
  const filtered = inSegment.filter(
    (row) =>
      (role === null || ROLE_TEST[role](row)) &&
      (!deferredQuery || row.name.toLocaleLowerCase().includes(deferredQuery))
  )
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted(
    (a, b) =>
      (sort.column === "answeredOn"
        ? (a.answeredOn ?? "").localeCompare(b.answeredOn ?? "")
        : a.name.localeCompare(b.name)) * sign
  )
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const narrowed = deferredQuery !== "" || role !== null
  const unanswered = all.filter(SEGMENT_TEST.none).length
  const answered = campaign.continuing + campaign.leaving

  return (
    <>
      <PageBar
        back={{ label: "census", link: { to: "/dashboard/people/census" } }}
        context={`${campaign.year} census`}
        right={
          isOpen ? (
            <>
              <Button size="sm" variant="outline" className={cn(buttonMotion, "max-shell:hidden")} disabled>
                <Bell data-icon="inline-start" />
                Send reminders
              </Button>
              <Button size="sm" className={buttonMotion} disabled>
                <Upload data-icon="inline-start" />
                Import responses
              </Button>
              <IconButton
                label="Close campaign"
                icon={Archive}
                appearance="boxed"
                className="size-10 max-shell:flex-none"
                disabled
              />
            </>
          ) : undefined
        }
      />
      <PageContent>
        <div className="flex flex-col gap-6">
          <MockupBanner phase={3} />
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
              placeholder: "Search by name…",
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
            label={`${campaign.year} census answers (mockup)`}
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            rowLabel={(row) => row.name}
            sort={sort}
            onSort={(next) => {
              setSort(next)
              setPage(1)
            }}
            actions={(row) => (
              <RowActions>
                {/* Answered rows open the answers; the others can be reminded while the campaign is open. */}
                {row.answer ? (
                  <IconButton
                    label="View answers"
                    ariaLabel={`View the answers of ${row.name}`}
                    icon={FileText}
                    disabled
                  />
                ) : isOpen ? (
                  <IconButton label="Send reminder" ariaLabel={`Send reminder to ${row.name}`} icon={Bell} disabled />
                ) : (
                  <span aria-hidden className="size-9 shrink-0" />
                )}
              </RowActions>
            )}
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
    </>
  )
}
