import { MOCK_PEOPLE } from "./mock-people"
import type { TelegramUserRef } from "./telegram-user-link"

export type ReportStatus = "pending" | "resolved"

export type ReportRow = {
  id: string
  groupTitle: string
  target: TelegramUserRef
  reporter: TelegramUserRef
  messagePreview: string
  status: ReportStatus
  resolution?: string
  resolutionReason?: string
  resolvedBy?: TelegramUserRef
  createdAt: Date
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)

export const MOCK_REPORTS: ReportRow[] = [
  {
    id: "1",
    groupTitle: "Ingegneria Informatica - Anno 1",
    target: MOCK_PEOPLE.andrea,
    reporter: MOCK_PEOPLE.martina,
    messagePreview: "Guadagna 5000€ al mese da casa, scrivimi in privato…",
    status: "pending",
    createdAt: hoursAgo(1),
  },
  {
    id: "2",
    groupTitle: "Design del Prodotto - Anno 2",
    target: MOCK_PEOPLE.davide,
    reporter: MOCK_PEOPLE.chiara,
    messagePreview: "Insulti ripetuti verso un'altra utente nel gruppo",
    status: "resolved",
    resolution: "Ban",
    resolvedBy: MOCK_PEOPLE.giulia,
    createdAt: hoursAgo(5),
  },
  {
    id: "3",
    groupTitle: "Erasmus 2023/2024",
    target: MOCK_PEOPLE.chiara,
    reporter: MOCK_PEOPLE.andrea,
    messagePreview: "Link sospetto: bit.ly/premio-erasmus",
    status: "resolved",
    resolution: "Delete",
    resolvedBy: MOCK_PEOPLE.marco,
    createdAt: hoursAgo(14),
  },
  {
    id: "4",
    groupTitle: "Fisica Tecnica - Laboratorio",
    target: MOCK_PEOPLE.martina,
    reporter: MOCK_PEOPLE.davide,
    messagePreview: "Messaggio ripetuto 20 volte nello stesso minuto",
    status: "resolved",
    resolution: "Kick",
    resolvedBy: MOCK_PEOPLE.sara,
    createdAt: hoursAgo(22),
  },
  {
    id: "5",
    groupTitle: "Tesi Magistrale - Chat",
    target: MOCK_PEOPLE.andrea,
    reporter: MOCK_PEOPLE.chiara,
    messagePreview: "Falso allarme, messaggio in realtà innocuo",
    status: "resolved",
    resolution: "Ignore",
    resolvedBy: MOCK_PEOPLE.giulia,
    createdAt: hoursAgo(30),
  },
  {
    id: "6",
    groupTitle: "Ingegneria Informatica - Anno 1",
    target: MOCK_PEOPLE.davide,
    reporter: MOCK_PEOPLE.martina,
    messagePreview: "Condivisione di materiale coperto da copyright",
    status: "pending",
    createdAt: hoursAgo(3),
  },
]
