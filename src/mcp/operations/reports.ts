import {
  dismissGroupLinkReport,
  getPendingGroupLinkReports,
  getResolvedGroupLinkReports,
  groupLinkReportIdsInput,
  resolveGroupLinkReport,
} from "@/features/group-link-reports/reports.functions"

import { destructive, read } from "../operation"

export const reportsOperations = [
  read("reports.links.listOpen", getPendingGroupLinkReports, {
    guard: "adminMiddleware",
    description:
      "Open reports from the website: broken Telegram or WhatsApp group links and missing groups. The backend requires web:reports:manage.",
  }),
  read("reports.links.listClosed", getResolvedGroupLinkReports, {
    guard: "adminMiddleware",
    description: "Resolved and dismissed group link reports.",
  }),
  destructive("reports.links.resolve", resolveGroupLinkReport, {
    guard: "reportsManageMiddleware",
    input: groupLinkReportIdsInput,
    description:
      "Mark reports resolved once the link or group is fixed (ids from reports.links.listOpen; pass every report of the same group). They can't be reopened.",
  }),
  destructive("reports.links.dismiss", dismissGroupLinkReport, {
    guard: "reportsManageMiddleware",
    input: groupLinkReportIdsInput,
    description: "Dismiss reports as not actionable (ids from reports.links.listOpen). They can't be reopened.",
  }),
]
