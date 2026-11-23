import { getAzureMembers } from "@/features/azure/azure.functions"
import { getAzureGroups } from "@/features/azure/groups.functions"

import { read } from "../operation"

/** Read-only by design: group membership drives IdP roles, and soci are admitted from Soci. */
export const microsoft365Operations = [
  read("microsoft365.members.list", getAzureMembers, {
    guard: "azureMembersReadMiddleware",
    description:
      "The Microsoft 365 member directory (accounts with their member numbers). Read-only: admit or renumber soci with the soci operations.",
  }),
  read("microsoft365.groups.list", getAzureGroups, {
    guard: "azureGroupsReadMiddleware",
    description:
      "The Microsoft 365 groups and their members. Read-only: membership grants IdP roles, so it is never edited from the dashboard.",
  }),
]
