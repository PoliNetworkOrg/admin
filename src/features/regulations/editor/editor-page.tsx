import { Construction } from "lucide-react"

import { EmptyState } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"

import type { Assignment, Draft } from "../regulations.contract"

/** The collaborative editor lands in the next pull request of this stack. */
export function EditorPage({ draft }: { draft: Draft; members: Assignment[] }) {
  return (
    <>
      <PageBar
        back={{ label: "bozze", link: { to: "/dashboard/regulations/drafts" } }}
        crumb="Bozze"
        context={draft.title}
      />
      <PageContent>
        <EmptyState
          icon={Construction}
          title="Editor in arrivo"
          text="L'editor collaborativo arriva con la prossima parte del lavoro."
        />
      </PageContent>
    </>
  )
}
