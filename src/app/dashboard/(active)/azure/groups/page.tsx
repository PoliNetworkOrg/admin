import type { Metadata } from "next"
import { getAzureGroups, getAzureMembers } from "@/server/actions/azure"
import { GroupsList } from "./groups-list"

export const metadata: Metadata = {
  title: "Microsoft 365 Groups",
}

export default async function AzureGroupsPage() {
  const [groups, directoryMembers] = await Promise.all([getAzureGroups(), getAzureMembers()])

  return (
    <main className="container w-full max-w-6xl">
      <GroupsList groups={groups} directoryMembers={directoryMembers} />
    </main>
  )
}
