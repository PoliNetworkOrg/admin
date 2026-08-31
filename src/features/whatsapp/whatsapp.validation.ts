import { z } from "zod"

export const WHATSAPP_INVITE_LINK_MAX = 128

/** Accepts only HTTPS WhatsApp group invite URLs with a non-empty invite code. */
export function isValidWhatsappInviteLink(value: string): boolean {
  if (value.length > WHATSAPP_INVITE_LINK_MAX || !URL.canParse(value)) return false

  const url = new URL(value)
  return (
    url.protocol === "https:" &&
    url.hostname === "chat.whatsapp.com" &&
    !url.username &&
    !url.password &&
    !url.hash &&
    /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
  )
}

export const whatsappInviteLink = z
  .string()
  .trim()
  .max(WHATSAPP_INVITE_LINK_MAX)
  .refine(isValidWhatsappInviteLink, "Enter a valid WhatsApp group invite link.")
