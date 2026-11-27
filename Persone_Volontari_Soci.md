# People, volontari e Soci — direzione di prodotto

**Versione:** 4.0 · **Aggiornamento:** 27 novembre 2026.

Fonti prevalenti: [roadmap #146](https://github.com/PoliNetworkOrg/admin/issues/146),
[cleanup #142](https://github.com/PoliNetworkOrg/admin/issues/142),
[fase 1 #143](https://github.com/PoliNetworkOrg/admin/issues/143),
[Soci #144](https://github.com/PoliNetworkOrg/admin/issues/144),
[censimento #145](https://github.com/PoliNetworkOrg/admin/issues/145).
[PRD](PRD_Admin_Dashboard_PoliNetwork.md), [roadmap operativa](PRD_Classificazione_Feature.md).

Questa revisione distingue codice integrato e lavoro residuo. Il contratto People corrente è in
[docs/people/contract.md](docs/people/contract.md); Soci segue il [design del 9 novembre](docs/people/soci.md).

## 1. Baseline

Admin#147/#148/#149 e Auth#73/backend#105/#106/#109 sono in main. People gestisce volontari e incarichi,
Auth identità reali e ruoli degli account collegati, Soci il registro separato collegato a Entra.
Censimento è un mockup senza API, con dati statici e azioni disabilitate: fase 3 ancora da progettare.

## 2. Cleanup completato nel codice

Sono rimossi matching, merge identità, utenti preliminari, gruppi Telegram People e ponte ricevute/eSign.
Non riaprire il cleanup come prossimo sviluppo e non recuperare il vecchio dominio unificato.
I mockup Soci e ricevute introdotti dalla transizione sono stati sostituiti da `soci.*` (#158/#163).
Le vecchie PR #132/#136/backend#99 non sono il percorso implementativo; usare i contratti correnti.

## 3. Fase 1 implementata: modello e responsabilità

Backend#105 implementa il modello relazionale (`src/db/schema/people/index.ts`); backend#106 aggiunge gli inviti.
La tabella riassume concetti del contratto; i nomi SQL sono definiti nello schema.

| Entità              | Dati e vincoli richiesti                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Persona             | ID stabile, nome/cognome obbligatori, contatto email, telefono e Telegram opzionali, note, `account_sub` nullable/univoco, autori/date |
| Incarico            | Persona, tipo `admin`/`capo`/`team`, team e ruolo, date/motivo fine, `assigned_by`, stato e motivo rifiuto                             |
| Capo di riferimento | Relazione alla scheda del Capo, distinta dal corso della persona; ambito sull'incarico Capo                                            |
| Activity            | Storico append-only di modifiche e collegamenti                                                                                        |
| Invito              | Token conservato come hash, destinatario, scadenza, uso/revoca e attore                                                                |

Le chiavi team restano configurate (`it`, `hr`, `design`, `events`) e verificate contro i binding Auth.
Un team senza ruoli associati non è assegnabile. Non occorre un catalogo dinamico di team per questo rilascio.

### Incarichi e fonte di verità

- Scheda senza account: incarichi **pending** nel backend, con chi li ha assegnati; Auth non riceve persone o ruoli.
- Scheda collegata: Auth è fonte dei ruoli. Backend legge i binding e invia comandi tramite outbox idempotente.
- Stati implementati: `pending`, `sent` (attesa Auth), `applied`, `refused` con motivo. La UI non mostra successo prima
  della conferma. Le revoche esterne in Auth si riflettono nelle viste.
- Un account con ruolo associato in Auth ma senza scheda produce una scheda già collegata.
- Cache e disponibilità seguono il contratto backend: gestire outage e revisioni senza far prevalere una risposta
  precedente su una revoca. Verificare TTL e soglie nel servizio corrente, senza dedurli dai mockup.

## 4. Binding e delega

Auth#73 è integrata: binding, comandi e delega sono codice corrente. La configurazione dei ruoli
nell'ambiente target resta una verifica operativa distinta dal merge (setup auth#79).

- Tipi ammessi: `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`; mai ruoli con `idp:*`, anche indiretti.
- Admin/membri: `admin:access` + `people:write`, oppure Lead del team per i suoi membri.
- Nomine Lead/Capo: `admin:access` + `people:appoint`.
- Nessuna autoassegnazione; nessuna concessione di permessi che l'attore non possiede.
- Auth calcola l'accesso corrente dell'attore e applica il comando tutto o niente; ambiguità e ruoli ancora
  ereditati causano un rifiuto esplicito. Il backend applica le stesse regole agli incarichi pending.
- Il permesso di binding `idp:people:bind` rende l'operazione delegabile.
  Non introdurre nuovi controlli hard-coded «solo Master Admin» per sostituire i permessi.

La gestione dei propri admin da parte del Capo è futura. Per ora il Capo legge soltanto; relazione e regole
per tipo di binding devono permettere un'estensione successiva senza concedere gestione oggi.

## 5. Esattamente due modi di collegare

Specifica: [backend#102](https://github.com/PoliNetworkOrg/backend/issues/102),
[admin#140](https://github.com/PoliNetworkOrg/admin/issues/140).

**Invito:** operatore con `people:write` o Lead nel proprio team invia alla mail di contatto. Token monouso,
hash a riposo, durata 14 giorni; reinvio invalida il precedente. Il destinatario entra con **qualsiasi account**,
anche con email diversa, e conferma il collegamento. Un account già collegato altrove viene rifiutato.

La pagina `/people/invite` vive fuori dalla shell, accessibile a qualsiasi account autenticato: richiedere
`people:self` prima di accettare crea un circolo, perché i ruoli arrivano solo dopo il link.

**Manuale:** `admin:access` + `people:link`; ricerca directory Auth, conferma, link con storico.
Non usare nome/email/Telegram per collegamenti automatici, suggerimenti da confermare o merge.

**Applicazione ruoli:** nel link manuale l'attore è chi collega; nell'invito è l'originario `assigned_by`
di ciascun incarico. Comandi distinti per attore, ID derivati dal link e retry idempotenti. Il destinatario
non è attore di una propria autoassegnazione. Se l'assegnatore ha perso delega, mostrare il rifiuto di Auth.

**Unlink:** con `people:link`, conferma che spiega la perdita ruoli; revocare in Auth prima di staccare l'account.
Gli incarichi tornano pending. Mostrare collegamenti degli ultimi 30 giorni con metodo, data e attore,
così un invito inoltrato o un link errato può essere individuato e annullato.

## 6. Pagine integrate sul nuovo contratto

Admin#148/#149 implementano:

- **Overview:** record, Admin, Capo, team, collegamento e stati pending/refused.
- **Scheda:** profilo, account, incarichi con stato/motivo e storico. Creazione con soli nome/cognome.
  Corso, sede, appartenenze associative e incarichi di rappresentanza sono in admin#186/backend#164.
- **Admins:** attivi e Capo di riferimento modificabile; nomina/fine Capo protette da `people:appoint`.
- **Capo Admin:** propri admin in sola lettura; scoping nel backend, non filtro solo browser.
- **Teams:** membri e Lead; il Lead gestisce soltanto i membri del proprio team.
- **La mia area:** propria scheda e ruoli con stato, con card Socio separata via `soci.me.*`, senza censimento.
- **Linking:** inviti, link manuale e collegamenti recenti; nessuna coda di matching.

## 7. Import persone e Libro Soci

L'import CSV generale People è stato stralciato ([backend#103](https://github.com/PoliNetworkOrg/backend/issues/103)
e [admin#141](https://github.com/PoliNetworkOrg/admin/issues/141)). Lo script di seed dal censimento
[admin#153](https://github.com/PoliNetworkOrg/admin/pull/153) è chiuso senza merge.

Per il Libro Soci è integrata una preview CSV locale in backend#152, documentata in admin#173.
La preview valida le colonne e produce un report. L'applicazione dei dati richiede una decisione separata.
[Procedura di preview](docs/people/soci-import.md).

## 8. Fase 2: Soci implementati in parte

Registro e ammissione (#158–#161), quote e My area (#163) sono in main, con backend#126/#128/#129 e Auth#86.
Entra fornisce appartenenza corrente e object ID; `employeeId` conserva il numero, non riutilizzabile.
L'ammissione passa da Soci con `soci:write`; backend#127 ha ritirato le scritture Azure precedenti.

La quota è 5 euro; il socio carica prova bonifico e il Direttivo conferma/rifiuta o marca pagato.
My area usa `people:self` anche senza scheda People, con identità Microsoft 365 verificata.
Nessuna ricevuta associativa numerata o firma CIE nel design approvato. Backend#130 implementa i compleanni.
Cessazione/ripristino, anteprima/job di decadenza e cancellazione account sono in admin#169/backend#151.
Le PR attendono la decisione del Direttivo sulla decadenza automatica. Il job nel branch è disattivato di default.

## 9. Fase 3: censimento admin

#145 richiede design dopo la fase 1. Le persone collegate rispondono in dashboard; le altre ricevono un invito.
La risposta «lascio» termina l'incarico admin con lo stesso comando Auth già usato in fase 1.
Definire calendario, solleciti, risposte tardive/correzioni, mancata risposta e informative. Non dedurre ruoli
da dichiarazioni sui gruppi o dallo status socio. Candidature e colloqui HR restano un processo distinto.

## 10. Verifiche e ordine residuo

Collaudare i binding configurati, pending/linked, ogni stato incarico, autoassegnazione, delega, Lead e Capo fuori ambito,
account senza permessi che accetta invito, email diverse, token scaduto/riusato/revocato, conflitti di account,
revoca all'unlink, retry e outage Auth. Usare backend/Auth reali in staging; agent mode serve alle fixture UI.

Per Soci: registrazione esistenti, ammissione, unicità numero, accesso proprio senza People, upload e sostituzione prova,
review concorrente sul `fileId`, rifiuto e pagamento manuale, annualità/esenzioni ed email idempotenti.
Completare il ciclo fine appartenenza prima di dichiarare operativa la decadenza automatica.

La preview Libro Soci e il nuovo censimento hanno percorsi distinti.
`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; test UI desktop/mobile e permessi limitati nelle PR funzionali.
Questa revisione documentale non autorizza ulteriori raccolte di dati o import di massa.
