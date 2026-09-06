import { MOCK_PEOPLE } from "./mock-people"
import type { TelegramUserRef } from "./telegram-user-link"

export type AuditLogType = "ban" | "unban" | "kick" | "mute" | "unmute" | "ban_all" | "unban_all"

export type AuditLogRow = {
  id: string
  type: AuditLogType
  target: TelegramUserRef
  admin: TelegramUserRef
  groupTitle?: string
  until?: Date
  reason?: string
  createdAt: Date
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)

export const MOCK_AUDIT_LOG: AuditLogRow[] = [
  {
    id: "1",
    type: "mute",
    target: MOCK_PEOPLE.andrea,
    admin: MOCK_PEOPLE.giulia,
    groupTitle: "Ingegneria Informatica - Anno 1",
    until: hoursAgo(-2),
    reason: "Spam ripetuto di link esterni",
    createdAt: hoursAgo(3),
  },
  {
    id: "2",
    type: "unmute",
    target: MOCK_PEOPLE.martina,
    admin: MOCK_PEOPLE.marco,
    groupTitle: "Design del Prodotto - Anno 2",
    createdAt: hoursAgo(6),
  },
  {
    id: "3",
    type: "kick",
    target: MOCK_PEOPLE.davide,
    admin: MOCK_PEOPLE.sara,
    groupTitle: "Erasmus 2023/2024",
    reason: "Comportamento offensivo verso altri membri",
    createdAt: hoursAgo(10),
  },
  {
    id: "4",
    type: "ban",
    target: MOCK_PEOPLE.chiara,
    admin: MOCK_PEOPLE.giulia,
    groupTitle: "Fisica Tecnica - Laboratorio",
    reason: "Pubblicità non autorizzata",
    createdAt: hoursAgo(18),
  },
  {
    id: "5",
    type: "unban",
    target: MOCK_PEOPLE.chiara,
    admin: MOCK_PEOPLE.marco,
    groupTitle: "Fisica Tecnica - Laboratorio",
    reason: "Ban revocato dopo chiarimento",
    createdAt: hoursAgo(17),
  },
  {
    id: "6",
    type: "ban_all",
    target: MOCK_PEOPLE.andrea,
    admin: MOCK_PEOPLE.sara,
    reason: "Started after report by davide_e",
    createdAt: hoursAgo(26),
  },
  {
    id: "7",
    type: "unban_all",
    target: MOCK_PEOPLE.andrea,
    admin: MOCK_PEOPLE.sara,
    createdAt: hoursAgo(25),
  },
  {
    id: "8",
    type: "mute",
    target: MOCK_PEOPLE.davide,
    admin: MOCK_PEOPLE.giulia,
    groupTitle: "Tesi Magistrale - Chat",
    until: hoursAgo(-24),
    reason: "Flood di messaggi",
    createdAt: hoursAgo(40),
  },
  {
    id: "9",
    type: "kick",
    target: MOCK_PEOPLE.martina,
    admin: MOCK_PEOPLE.marco,
    groupTitle: "Ingegneria Informatica - Anno 1",
    createdAt: hoursAgo(60),
  },
]
