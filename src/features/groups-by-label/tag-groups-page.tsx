import { Link } from "@tanstack/react-router"
import { Plus, Tags } from "lucide-react"
import { useRef, useState } from "react"

import {
  buttonMotion,
  EmptyState,
  labelDisplayName,
  labelKind,
  RecordHeader,
  SectionHeading,
} from "@/components/primitives"
import { type PageBarBack, PageBar, PageContent, SearchField, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { GroupLabel } from "@/features/group-labels/types"
import type { GroupWithLabels, TgGroup } from "@/lib/api/types"
import { pluralize } from "@/lib/format"

import { AddGroupToLabelDialog } from "./add-group-to-label-dialog"
import { CombinedGroupsTable } from "./combined-groups-table"
import { GROUP_SEARCH_PLACEHOLDER, useLabelGroups } from "./label-groups"
import { PublishTagGroupsDialog } from "./publish-tag-groups-dialog"

const back: PageBarBack = { label: "labels", link: { to: "/dashboard/web/group-labels" } }

type TagGroupsPageProps = {
  /** An attribute or a `release-` publication; categories redirect to their browser page in the route. */
  tag: string
  labels: GroupLabel[]
  groups: GroupWithLabels[]
  tgGroups: TgGroup[]
}

/** One flat tag's groups: the category node layout without sub-categories. */
export function TagGroupsPage({ tag, labels, groups, tgGroups }: TagGroupsPageProps) {
  const canWrite = useCanWrite("web")
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [query, setQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)

  const label = labels.find((candidate) => candidate.label === tag) ?? null
  const { rows, visible, searching } = useLabelGroups({ label: tag, query, groups, tgGroups })
  const kind = labelKind(tag)
  const title = labelDisplayName(tag)

  if (kind === "category" || (!label && rows.length === 0)) {
    return (
      <>
        <PageBar back={back} context="Labels" />
        <PageContent width="wide">
          <h1 className="sr-only">Tag not found</h1>
          <EmptyState
            icon={Tags}
            title="Tag not found"
            text="It may have been published, renamed or deleted."
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link to="/dashboard/web/group-labels" />}
                className={buttonMotion}
              >
                Go to labels
              </Button>
            }
          />
        </PageContent>
      </>
    )
  }

  const publication = kind === "publication"
  const publishable = publication && rows.length > 0

  return (
    <>
      <PageBar
        back={back}
        context={publication ? "Publications" : "Attributes"}
        scrollTitleRef={titleRef}
        scrollTitle={title}
        right={
          canWrite && (
            <>
              <Button
                variant={publishable ? "outline" : "default"}
                size="sm"
                onClick={() => setAddOpen(true)}
                className={buttonMotion}
              >
                <Plus aria-hidden data-icon="inline-start" />
                Add group
              </Button>
              {publication && <PublishTagGroupsDialog tag={tag} rows={rows} />}
            </>
          )
        }
      />
      <PageContent width="wide">
        <div className="flex flex-col gap-8">
          <RecordHeader
            titleRef={titleRef}
            title={title}
            dot={label?.color}
            meta={
              publication ? (
                "Publishing makes these groups visible and clears this tag."
              ) : (
                <span className="tabular-nums">{pluralize(rows.length, "group")} with this attribute.</span>
              )
            }
            description={label?.description}
          />

          <section className="flex flex-col gap-3" aria-labelledby="tag-groups">
            <SectionHeading
              id="tag-groups"
              title="Groups"
              action={
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder={GROUP_SEARCH_PLACEHOLDER}
                  className="w-70"
                />
              }
            />
            <CombinedGroupsTable
              rows={visible}
              labels={labels}
              tgGroups={tgGroups}
              canWrite={canWrite}
              empty={
                searching ? (
                  <EmptyState
                    icon={Tags}
                    title="No groups match"
                    text="Try a different group name or tag."
                    action={
                      <Button variant="ghost" size="sm" onClick={() => setQuery("")} className={buttonMotion}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Tags}
                    title={`No groups tagged ${title}`}
                    text="Add existing groups to this tag to start using it."
                    action={
                      canWrite && (
                        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className={buttonMotion}>
                          <Plus aria-hidden data-icon="inline-start" />
                          Add group
                        </Button>
                      )
                    }
                  />
                )
              }
            />
          </section>
        </div>
      </PageContent>

      <AddGroupToLabelDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        path={tag}
        labels={labels}
        groups={groups}
        tgGroups={tgGroups}
        allowCreate={false}
      />
    </>
  )
}
