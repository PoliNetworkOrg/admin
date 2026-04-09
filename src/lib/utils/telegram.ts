export function stripChatId(chatId: number): number {
  if (chatId > 0) return chatId
  const positive = -chatId

  const str = positive.toString()
  if (str.length < 13) return positive
  return parseInt(str.slice(1), 10)
}
