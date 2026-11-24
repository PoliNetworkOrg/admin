/**
 * The backend records history events with fixed English labels (`service.ts` in the backend's associations module).
 * The portal is in Italian, so known labels are translated here; an unknown one is shown as is rather than hidden.
 */
const eventLabels = new Map([
  ["Association registered by PoliNetwork", "Associazione registrata da PoliNetwork"],
  ["Registration submitted", "Richiesta di registrazione inviata"],
  ["Registration draft saved", "Bozza di registrazione salvata"],
  ["Registration redirected", "Registrazione trasferita a un’associazione già nel registro"],
  [
    "Access request received from an existing application",
    "Richiesta di accesso ricevuta da una registrazione trasferita",
  ],
  ["Draft saved", "Bozza salvata"],
  ["Requested information supplied", "Integrazioni inviate"],
  ["Request submitted", "Richiesta inviata"],
  ["Request withdrawn", "Richiesta ritirata"],
  ["Request approved", "Richiesta approvata"],
  ["Request changes", "Integrazioni richieste"],
  ["Request rejected", "Richiesta respinta"],
  ["Access requested", "Accesso richiesto"],
  ["Representative change requested", "Modifica dei referenti richiesta"],
  ["Invitation accepted; awaiting PoliNetwork", "Invito accettato, in attesa di PoliNetwork"],
  ["Representative left", "Il referente ha lasciato l’associazione"],
  ["Representative revoked", "Referente revocato"],
  ["Association active", "Associazione riattivata"],
  ["Association suspended", "Associazione sospesa"],
  ["Association archived", "Associazione archiviata"],
  ["Profile unpublished", "Scheda rimossa dal sito"],
  ["Internal note updated", "Nota interna aggiornata"],
  ["Contacts updated", "Contatti aggiornati"],
  ["Public contacts proposed", "Contatti pubblici aggiunti alla proposta di scheda"],
  ["Contacts to update", "Contatti da aggiornare: il referente collegato non ha più accesso"],
  ["Open to collaborations", "Aperta a collaborazioni"],
  ["Closed to collaborations", "Non più aperta a collaborazioni"],
  ["Handover started", "Passaggio di consegne avviato"],
  ["Handover contacts reviewed", "Contatti personali rivisti per il passaggio di consegne"],
  ["Handover completed", "Passaggio di consegne completato"],
  ["Handover cancelled", "Passaggio di consegne annullato"],
])

export function eventLabel(action: string) {
  return eventLabels.get(action) ?? action
}
