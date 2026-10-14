import { Construction } from "lucide-react"

import { EmptyState } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"

/** Stand-in while the People pages are built (docs/people/plan.md); removed once every page exists. */
export function PagePlaceholder() {
  return (
    <>
      <PageBar />
      <PageContent>
        <EmptyState
          icon={Construction}
          title="Being built"
          text="This page is part of the People area work in progress."
        />
      </PageContent>
    </>
  )
}
