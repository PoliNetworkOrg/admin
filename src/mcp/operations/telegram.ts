import { z } from "zod"

import {
  createTelegramGrant,
  getTelegramGrants,
  interruptTelegramGrant,
  telegramGrantFields,
  telegramGrantUserInput,
} from "@/features/telegram/grants.functions"
import {
  getTelegramGroups,
  leaveTelegramGroup,
  setGroupVisibility,
  telegramGroupChatInput,
  telegramGroupVisibilityInput,
} from "@/features/telegram/groups.functions"
import {
  findTelegramUser,
  getTelegramUserDetails,
  getTelegramUsers,
  telegramUserIdInput,
  telegramUserLookupInput,
} from "@/features/telegram/users.functions"

import { destructive, read, write } from "../operation"

const isoDateTime = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .describe("ISO 8601 date-time, e.g. 2026-12-01T09:00:00+01:00")

/**
 * The grant schema takes `Date`s, which JSON can't carry: the MCP parses ISO strings into `Date`s with this schema,
 * whose output the server function's own `telegramGrantInput` then validates. Its end-after-start check is repeated
 * here, so a wrong order is invalid input rather than a failed call.
 */
const telegramGrantJsonInput = z
  .object({ ...telegramGrantFields, since: isoDateTime, until: isoDateTime })
  .refine(({ since, until }) => until > since, { message: "The grant end must be after its start.", path: ["until"] })

export const telegramOperations = [
  read("telegram.groups.list", getTelegramGroups, {
    guard: "adminMiddleware",
    description: "List the Telegram groups the bot is in, hidden ones included, with their telegramId.",
  }),
  write("telegram.groups.setVisibility", setGroupVisibility, {
    guard: "telegramGroupsWriteMiddleware",
    input: telegramGroupVisibilityInput,
    description:
      "Hide one Telegram group from the public website, or show it again. telegramId from telegram.groups.list.",
  }),
  destructive("telegram.groups.leave", leaveTelegramGroup, {
    guard: "telegramGroupsWriteMiddleware",
    input: telegramGroupChatInput,
    description:
      "The bot leaves one Telegram group and its record is deleted; it can't be undone here. chatId is the group's telegramId from telegram.groups.list.",
  }),
  read("telegram.users.list", getTelegramUsers, {
    guard: "adminMiddleware",
    description: "List every Telegram user the bot knows. The backend requires tg:users:read.",
  }),
  read("telegram.users.find", findTelegramUser, {
    guard: "adminMiddleware",
    input: telegramUserLookupInput,
    description:
      'Find one Telegram user by username (with or without @, by: "username") or by numeric id (by: "id"). Returns status found, not-found or error.',
  }),
  read("telegram.users.get", getTelegramUserDetails, {
    guard: "adminMiddleware",
    input: telegramUserIdInput,
    description:
      "One Telegram user with their last messages, audit log and grants; each section is null without tg:messages:read, tg:audit:read or tg:grants:read.",
  }),
  read("telegram.grants.list", getTelegramGrants, {
    guard: "adminMiddleware",
    description:
      "The ongoing and scheduled Telegram grants (temporary permission to post links and the like). The backend requires tg:grants:read.",
  }),
  write("telegram.grants.create", createTelegramGrant, {
    guard: "grantsWriteMiddleware",
    input: telegramGrantJsonInput,
    description:
      "Grant one Telegram user (id from telegram.users.find) from since until until (ISO date-times, until after since), with an optional reason. Posted to the Telegram log.",
  }),
  destructive("telegram.grants.interrupt", interruptTelegramGrant, {
    guard: "grantsWriteMiddleware",
    input: telegramGrantUserInput,
    description: "End one Telegram user's ongoing grant now. Posted to the Telegram log; it can't be resumed.",
  }),
]
