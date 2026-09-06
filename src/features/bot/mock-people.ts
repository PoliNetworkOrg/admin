import type { TelegramUserRef } from "./telegram-user-link"

export const MOCK_PEOPLE = {
  giulia: { telegramId: 100001, firstName: "Giulia", lastName: "Rossi", username: "giuliar" },
  marco: { telegramId: 100002, firstName: "Marco", lastName: "Bianchi", username: "marcob" },
  sara: { telegramId: 100003, firstName: "Sara", lastName: "Verdi", username: "sarav" },
  luca: { telegramId: 100004, firstName: "Luca", lastName: "Ferrari" },
  bot: { telegramId: 100005, firstName: "Sistema", username: "polinetwork_bot" },
  andrea: { telegramId: 200101, firstName: "Andrea", lastName: "Colombo", username: "andreac" },
  martina: { telegramId: 200102, firstName: "Martina", lastName: "Greco" },
  davide: { telegramId: 200103, firstName: "Davide", lastName: "Esposito", username: "davide_e" },
  chiara: { telegramId: 200104, firstName: "Chiara", lastName: "Romano" },
} satisfies Record<string, TelegramUserRef>
