import { Plus, UserRoundPlus } from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { MemberDialog } from "./member-dialog"

export function AzureMembersPage() {
  const canCreate = useCan("azure:members:create")
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageBar title="Create a member" />
      <PageContent>
        <EmptyState
          icon={UserRoundPlus}
          title="New association member"
          text="Create a Microsoft 365 account with its membership number and welcome email."
        />
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            Create member
          </Button>
        )}
        {canCreate && (
          <MemberDialog
            open={open}
            onOpenChange={setOpen}
            onSaved={() => {
              appToast.success("Member created.")
              return Promise.resolve()
            }}
          />
        )}
      </PageContent>
    </>
  )
}
