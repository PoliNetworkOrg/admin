/**
 * The backend's association errors are fixed English sentences (`service.ts`, `promotions.ts`, `router.ts`). The portal
 * is in Italian, so known ones are translated where the API replies; an unknown message is shown as is.
 */
const messages = new Map([
  [
    "A cross-programme association does not list degree programmes",
    "Un’associazione trasversale non elenca corsi di studio.",
  ],
  ["Active representative not found", "Referente attivo non trovato."],
  ["Add a title and a text before submitting", "Aggiungi titolo e testo prima di inviare la richiesta."],
  ["Already registered", "L’associazione è già registrata."],
  ["An invitation is already pending for this address", "C’è già un invito in attesa per questo indirizzo."],
  [
    "Approve a replacement responsible first; use explicit revocation for urgent removal",
    "Approva prima un nuovo responsabile; per una rimozione urgente usa la revoca.",
  ],
  ["Association not found", "Associazione non trovata."],
  ["Choose a different association", "Scegli un’altra associazione."],
  ["Choose a valid PNG or JPEG logo", "Scegli un logo PNG o JPEG valido."],
  ["Choose a valid PNG or JPEG poster", "Scegli una locandina PNG o JPEG valida."],
  ["Choose at least one channel", "Scegli almeno un canale."],
  ["Choose campuses from the catalogue", "Scegli le sedi dal catalogo di PoliNetwork."],
  ["Choose programmes from the catalogue", "Scegli i corsi dal catalogo di PoliNetwork."],
  ["Choose the audience: everyone, or programmes or campuses", "Scegli il pubblico: tutti, oppure corsi o sedi."],
  ["Choose the degree programme for each course channel", "Scegli il corso di studio per ogni canale di corso."],
  ["Choose the desired date", "Scegli la data desiderata."],
  [
    "Complete both descriptions before submitting the public profile",
    "Completa entrambe le descrizioni prima di inviare la scheda.",
  ],
  ["Duplicate contact", "Contatto duplicato."],
  ["Each programme and campus can be listed once", "Ogni corso e ogni sede possono comparire una sola volta."],
  ["Explain the request before submitting", "Spiega la richiesta prima di inviarla."],
  ["Invitation expired or revoked", "Invito scaduto o revocato."],
  [
    "Link a contact only to one of the association's representatives",
    "Collega il contatto solo a un referente dell’associazione.",
  ],
  ["Only a responsible can propose representatives", "Solo un responsabile può proporre referenti."],
  [
    "Only an unapproved registration can be redirected to an active association",
    "Solo una registrazione non approvata può essere trasferita a un’associazione attiva.",
  ],
  ["Only the applicant can answer a request for information", "Solo chi ha fatto la richiesta può rispondere."],
  ["Only the applicant can edit this request", "Solo chi ha fatto la richiesta può modificarla."],
  [
    "Only the association's representatives can prepare a request",
    "Solo i referenti dell’associazione possono preparare una richiesta.",
  ],
  ["Only the responsible can submit the request", "Solo il responsabile può inviare la richiesta."],
  ["PoliNetwork approval is required", "Serve l’approvazione di PoliNetwork."],
  ["Promotion request not found", "Richiesta di promozione non trovata."],
  ["Reactivate the association before approving changes", "Riattiva l’associazione prima di approvare modifiche."],
  ["Reactivate the association before approving", "Riattiva l’associazione prima di approvare."],
  ["Register the association first", "Registra prima l’associazione."],
  ["Reload the request before continuing", "Ricarica la richiesta prima di continuare."],
  ["Representative not found", "Referente non trovato."],
  ["Request not found", "Richiesta non trovata."],
  ["Review registration first", "Esamina prima la registrazione."],
  ["The applicant already has access", "La persona ha già accesso."],
  [
    "The association changed. Reload before continuing.",
    "L’associazione è cambiata. Ricarica la pagina prima di continuare.",
  ],
  ["The deadline cannot come before the desired date", "La scadenza non può precedere la data desiderata."],
  ["The desired date has passed", "La data desiderata è già passata."],
  ["The invited person must accept before approval", "La persona invitata deve accettare prima dell’approvazione."],
  [
    "The request cannot take this step in its current state",
    "La richiesta non può fare questo passaggio nello stato attuale.",
  ],
  [
    "The request changed. Reload before continuing.",
    "La richiesta è cambiata. Ricarica la pagina prima di continuare.",
  ],
  ["The request is not awaiting review", "La richiesta non è in attesa di revisione."],
  ["There is already a working profile", "C’è già una proposta di scheda in corso."],
  [
    "This association is not available for an access request",
    "Non è possibile richiedere accesso a questa associazione.",
  ],
  ["This request cannot be submitted", "Questa richiesta non può essere inviata."],
  ["This request has no editable profile", "Questa richiesta non ha una scheda modificabile."],
  ["This request is already closed", "Questa richiesta è già chiusa."],
  ["Too many access requests today. Contact PoliNetwork.", "Troppe richieste di accesso oggi. Contatta PoliNetwork."],
  ["Too many requests today. Contact PoliNetwork.", "Troppe richieste oggi. Contatta PoliNetwork."],
  ["Too many uploads. Try later.", "Troppi caricamenti. Riprova più tardi."],
  [
    "Withdraw the submitted profile before changing public contacts",
    "Ritira la proposta di scheda in revisione prima di cambiare i contatti pubblici.",
  ],
  ["Withdraw the submitted request before editing", "Ritira la richiesta inviata prima di modificarla."],
  ["Only a responsible can start a handover", "Solo un responsabile può avviare il passaggio di consegne."],
  ["A handover is already in progress", "C’è già un passaggio di consegne in corso."],
  ["No handover is in progress", "Non c’è un passaggio di consegne in corso."],
  [
    "Only the outgoing responsible can continue the handover",
    "Solo il responsabile uscente può portare avanti il passaggio di consegne.",
  ],
  ["Confirm only the contacts to review", "Conferma solo i contatti da rivedere."],
  [
    "Get a new responsible approved before completing the handover",
    "Prima di completare il passaggio serve un nuovo responsabile approvato da PoliNetwork.",
  ],
  [
    "Review the personal contacts before completing the handover",
    "Rivedi i contatti personali prima di completare il passaggio.",
  ],
  ["Choose one of the association's contacts", "Scegli uno dei contatti dell’associazione."],
  ["Choose an event of this association", "Scegli un evento di questa associazione."],
  ["Event not found", "Evento non trovato."],
  ["The event changed. Reload before continuing.", "L’evento è cambiato. Ricarica la pagina prima di continuare."],
  ["The event cannot end before it starts", "L’evento non può finire prima di iniziare."],
  [
    "Add a title and both descriptions before submitting",
    "Aggiungi titolo ed entrambe le descrizioni prima di inviare.",
  ],
  ["Choose when the event starts", "Scegli quando inizia l’evento."],
  ["The event has already started", "L’evento è già iniziato."],
  ["Add the venue, or mark the event as online", "Indica il luogo, oppure segna l’evento come online."],
  [
    "Only the association's representatives can propose an event",
    "Solo i referenti dell’associazione possono proporre un evento.",
  ],
  ["Only the responsible can submit the event", "Solo il responsabile può inviare l’evento."],
  ["You cannot edit this event", "Non puoi modificare questo evento."],
  ["You cannot withdraw this event", "Non puoi ritirare questo evento."],
  [
    "Set the cost: a requested channel has no fixed cost",
    "Indica il costo: un canale richiesto non ha un costo fisso.",
  ],
  ["The association does not have enough credits", "L’associazione non ha crediti sufficienti."],
  ["A grant must be positive", "Un’assegnazione deve essere positiva."],
  ["You already have an open access request", "Hai già una richiesta di accesso aperta."],
  [
    "You already have ten registration drafts or requests. Contact PoliNetwork.",
    "Hai già dieci bozze o richieste di registrazione. Contatta PoliNetwork.",
  ],
  ["You already represent this association", "Rappresenti già questa associazione."],
  ["You cannot comment on this request", "Non puoi commentare questa richiesta."],
  ["You cannot edit this association", "Non puoi modificare questa associazione."],
  ["You cannot edit this request", "Non puoi modificare questa richiesta."],
  ["You cannot submit this request", "Non puoi inviare questa richiesta."],
  ["You cannot withdraw this request", "Non puoi ritirare questa richiesta."],
])

export function portalErrorMessage(message: string) {
  return messages.get(message) ?? message
}

/** Calls `operation` and rethrows any error with its message in Italian. */
export async function inItalian<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(error)
    if (error instanceof Error) {
      const translated = portalErrorMessage(error.message)
      if (translated !== error.message) throw new Error(translated, { cause: error })
    }
    throw error
  }
}
