import type { TgUser } from "../../server/trpc/types"

export function stripChatId(chatId: number): number {
  if (chatId > 0) return chatId
  const positive = -chatId

  const str = positive.toString()
  if (str.length < 13) return positive
  return parseInt(str.slice(1), 10)
}

export function fmtUser(user: TgUser, printId: boolean = true) {
  let string = user.firstName
  if (user.lastName) string += ` ${user.lastName}`
  if (user.username) string += ` @${user.username}`
  if (printId) string += ` [${user.id}]`
  return string
}
