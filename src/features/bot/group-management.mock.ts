import { MOCK_PEOPLE } from "./mock-people"
import type { TelegramUserRef } from "./telegram-user-link"

export type GroupManagementType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LEAVE"
  | "LEAVE_FAIL"
  | "CREATE_FAIL"
  | "UPDATE_FAIL"
  | "REGENERATE_LINKS_START"
  | "REGENERATE_LINKS_COMPLETE"
  | "REGENERATE_LINKS_ABORTED"

export type GroupManagementLogRow = {
  id: string
  type: GroupManagementType
  groupTitle?: string
  performedBy: TelegramUserRef
  detail: string
  createdAt: Date
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)

export const MOCK_GROUP_MANAGEMENT_LOG: GroupManagementLogRow[] = [
  {
    id: "1",
    type: "CREATE",
    groupTitle: "Ingegneria Informatica - Anno 1",
    performedBy: MOCK_PEOPLE.giulia,
    detail: "Invito generato: t.me/+aB3xY9",
    createdAt: hoursAgo(2),
  },
  {
    id: "2",
    type: "UPDATE",
    groupTitle: "Ingegneria Informatica - Anno 1",
    performedBy: MOCK_PEOPLE.giulia,
    detail: "Titolo e descrizione aggiornati",
    createdAt: hoursAgo(1.5),
  },
  {
    id: "3",
    type: "REGENERATE_LINKS_START",
    performedBy: MOCK_PEOPLE.marco,
    detail: "Rigenerazione richiesta per tutti i gruppi pubblici",
    createdAt: hoursAgo(20),
  },
  {
    id: "4",
    type: "REGENERATE_LINKS_COMPLETE",
    performedBy: MOCK_PEOPLE.marco,
    detail: "128 totali · 126 rigenerati · 2 falliti",
    createdAt: hoursAgo(19.5),
  },
  {
    id: "5",
    type: "CREATE_FAIL",
    groupTitle: "Design del Prodotto - Anno 2",
    performedBy: MOCK_PEOPLE.sara,
    detail: "Telegram API: CHAT_ADMIN_REQUIRED",
    createdAt: hoursAgo(30),
  },
  {
    id: "6",
    type: "LEAVE",
    groupTitle: "Erasmus 2023/2024",
    performedBy: MOCK_PEOPLE.luca,
    detail: "Gruppo archiviato, bot rimosso su richiesta",
    createdAt: hoursAgo(48),
  },
  {
    id: "7",
    type: "LEAVE_FAIL",
    groupTitle: "Tesi Magistrale - Chat",
    performedBy: MOCK_PEOPLE.luca,
    detail: "Telegram API: USER_NOT_PARTICIPANT",
    createdAt: hoursAgo(47.5),
  },
  {
    id: "8",
    type: "DELETE",
    groupTitle: "Vecchio gruppo Matricole 2019",
    performedBy: MOCK_PEOPLE.bot,
    detail: "Rimosso perché il gruppo Telegram non esiste più",
    createdAt: hoursAgo(72),
  },
  {
    id: "9",
    type: "UPDATE_FAIL",
    groupTitle: "Fisica Tecnica - Laboratorio",
    performedBy: MOCK_PEOPLE.giulia,
    detail: "Telegram API: CHAT_NOT_MODIFIED",
    createdAt: hoursAgo(96),
  },
  {
    id: "10",
    type: "REGENERATE_LINKS_ABORTED",
    performedBy: MOCK_PEOPLE.marco,
    detail: "Interrotta manualmente dopo il timeout dell'operazione precedente",
    createdAt: hoursAgo(120),
  },
]
