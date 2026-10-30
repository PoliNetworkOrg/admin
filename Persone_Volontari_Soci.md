# People, volontari e Soci — direzione di prodotto

**Versione:** 3.0 · **Aggiornamento:** 30 ottobre 2026.

Fonti prevalenti: [roadmap #146](https://github.com/PoliNetworkOrg/admin/issues/146),
[cleanup #142](https://github.com/PoliNetworkOrg/admin/issues/142),
[fase 1 #143](https://github.com/PoliNetworkOrg/admin/issues/143),
[Soci #144](https://github.com/PoliNetworkOrg/admin/issues/144),
[censimento #145](https://github.com/PoliNetworkOrg/admin/issues/145).
[PRD](PRD_Admin_Dashboard_PoliNetwork.md), [roadmap operativa](PRD_Classificazione_Feature.md).

Questa revisione sostituisce il progetto del registro unico People/Libro Soci e del matching tramite Telegram.
I vecchi dettagli di schema, permessi e API non sono specifiche da ripristinare. `docs/people/*` e #97/#100
spiegano l'implementazione in main e forniscono riferimenti storici; #146 stabilisce il prossimo lavoro.

## 1. Da dove partiamo

Admin #97/#100/#134 e backend #83/#94 hanno integrato pagine e API per persone, soci, quote, ricevute,
censimento, consensi e collegamenti. La roadmap #146 riporta l'area People vuota e non collegata ai ruoli RBAC,
con dati soltanto di test. Non basta rendere visibili altre colonne: va separato il dominio e chiusa la delega Auth.

| Dominio    | Direzione approvata                                                 | Cosa non implica                                         |
| ---------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| People     | Record backend, incarichi Admin/Capo/team, account Auth facoltativo | Non crea soci e non assegna gruppi Telegram              |
| Auth       | Identità reali e ruoli RBAC degli account collegati                 | Non conserva persone preliminari senza credenziali       |
| Soci       | Entra ID, object ID come chiave, numero in `employeeId`             | Non usa schede o inviti People                           |
| Censimento | Conferma degli admin sugli incarichi fase 1                         | Non ricostruisce il vecchio censimento misto soci/gruppi |

## 2. Cleanup: prima della nuova funzionalità

[Admin#147](https://github.com/PoliNetworkOrg/admin/pull/147) realizza
[#138](https://github.com/PoliNetworkOrg/admin/issues/138). È ancora una PR, non lo stato di main.

- Libro Soci, ricevute, censimento e card quota restano mockup con dati statici, banner esplicito e azioni disabilitate.
  Visibili con `people:read`, non a chi possiede solo `people:self`.
- Rimuovere server functions, chiamate e contratto di quei flussi; eliminare anche i conteggi della shell collegati.
- Eliminare matching/review/merge, «Sei tu?», collegamenti dedotti, gruppi amministrati/richiesti e approvazioni Capo.
- Togliere ponte ricevute/eSign e permessi `people:members:*`, `people:fees:write`, `people:receipts:sign`.
  Conservare eSign generico e miglioramenti condivisi al viewer.
- Conservare schede, Admin, Capo Admin, Team, inviti/link manuale e La mia area come base della fase 1.

**Ordine:** distribuire admin #147, poi [backend#104](https://github.com/PoliNetworkOrg/backend/pull/104)
(issue #100), poi [auth#77](https://github.com/PoliNetworkOrg/auth/issues/77). Il backend elimina tabelle/flussi
obsoleti; nessun dato People di test viene migrato secondo #146. Questo documento non esegue cancellazioni.

Accettazione: nessuna chiamata alle procedure rimosse, inclusi layout/badge; mockup chiaramente riconoscibili;
contratto residuo compatibile durante l'ordine di deploy; verifiche e agent mode passano.

## 3. Fase 1: modello e responsabilità

[Backend#101](https://github.com/PoliNetworkOrg/backend/issues/101) definisce il nuovo modello relazionale.
I nomi sotto sono concetti del contratto da implementare, non tabelle già disponibili in main.

| Entità              | Dati e vincoli richiesti                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Persona             | ID stabile, nome/cognome obbligatori, contatto email, telefono e Telegram opzionali, note, `account_sub` nullable/univoco, autori/date |
| Incarico            | Persona, tipo `admin`/`capo`/`team`, team e ruolo, date/motivo fine, `assigned_by`, stato e motivo rifiuto                             |
| Capo di riferimento | Relazione alla scheda del Capo, distinta dal corso della persona; ambito sull'incarico Capo                                            |
| Activity            | Storico append-only di modifiche e collegamenti                                                                                        |
| Invito              | Token conservato come hash, destinatario, scadenza, uso/revoca e attore                                                                |

Le chiavi team restano configurate (`it`, `hr`, `design`, `intl`, `events`) e verificate contro i binding Auth.
Un team senza ruoli associati non è assegnabile. Non occorre un catalogo dinamico di team per questo rilascio.

### Incarichi e fonte di verità

- Scheda senza account: incarichi **pending** nel backend, con chi li ha assegnati; Auth non riceve persone o ruoli.
- Scheda collegata: Auth è fonte dei ruoli. Backend legge i binding e invia comandi tramite outbox idempotente.
- Stati richiesti: `pending`, `sent` (attesa Auth), `applied`, `refused` con motivo. La UI non mostra successo prima
  della conferma. Le revoche esterne in Auth si riflettono nelle viste.
- Un account con ruolo associato in Auth ma senza scheda produce una scheda già collegata.
- Cache e disponibilità seguono il contratto backend: gestire outage e revisioni senza far prevalere una risposta
  precedente su una revoca. TTL e soglia massima vanno fissati nel contratto implementativo, non dedotti dai mockup.

## 4. Binding e delega

[Auth#78](https://github.com/PoliNetworkOrg/auth/issues/78) rielabora la PR #73; il codice preliminare di #75
va rimosso e la PR nuovamente revisionata. [Auth#79](https://github.com/PoliNetworkOrg/auth/issues/79)
configura i binding in produzione prima del backend.

- Tipi ammessi: `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`; mai ruoli con `idp:*`, anche indiretti.
- Admin/membri: `admin:access` + `people:write`, oppure Lead del team per i suoi membri.
- Nomine Lead/Capo: `admin:access` + `people:appoint`.
- Nessuna autoassegnazione; nessuna concessione di permessi che l'attore non possiede.
- Auth calcola l'accesso corrente dell'attore e applica il comando tutto o niente; ambiguità e ruoli ancora
  ereditati causano un rifiuto esplicito. Il backend applica le stesse regole agli incarichi pending.
- Il nuovo permesso di binding (`idp:people:bind`, nome da confermare) rende l'operazione delegabile.
  Non introdurre nuovi controlli hard-coded «solo Master Admin» per sostituire i permessi.

La gestione dei propri admin da parte del Capo è futura. Per ora il Capo legge soltanto; relazione e regole
per tipo di binding devono permettere un'estensione successiva senza concedere gestione oggi.

## 5. Esattamente due modi di collegare

Specifica: [backend#102](https://github.com/PoliNetworkOrg/backend/issues/102),
[admin#140](https://github.com/PoliNetworkOrg/admin/issues/140).

**Invito:** operatore con `people:write` o Lead nel proprio team invia alla mail di contatto. Token monouso,
hash a riposo, durata 14 giorni; reinvio invalida il precedente. Il destinatario entra con **qualsiasi account**,
anche con email diversa, e conferma il collegamento. Un account già collegato altrove viene rifiutato.

Serve una pagina esterna alla shell dashboard, accessibile a qualsiasi account autenticato: richiedere
`people:self` prima di accettare crea un circolo, perché i ruoli arrivano solo dopo il link.

**Manuale:** `admin:access` + nuovo `people:link`; ricerca directory Auth, conferma, link con storico.
Non usare nome/email/Telegram per collegamenti automatici, suggerimenti da confermare o merge.

**Applicazione ruoli:** nel link manuale l'attore è chi collega; nell'invito è l'originario `assigned_by`
di ciascun incarico. Comandi distinti per attore, ID derivati dal link e retry idempotenti. Il destinatario
non è attore di una propria autoassegnazione. Se l'assegnatore ha perso delega, mostrare il rifiuto di Auth.

**Unlink:** con `people:link`, conferma che spiega la perdita ruoli; revocare in Auth prima di staccare l'account.
Gli incarichi tornano pending. Mostrare collegamenti degli ultimi 30 giorni con metodo, data e attore,
così un invito inoltrato o un link errato può essere individuato e annullato.

## 6. Pagine da costruire sul nuovo contratto

[Admin#139](https://github.com/PoliNetworkOrg/admin/issues/139):

- **Overview:** record, Admin, Capo, team, collegamento e stati pending/refused.
- **Scheda:** profilo, account, incarichi con stato/motivo e storico. Creazione con soli nome/cognome.
- **Admins:** attivi e Capo di riferimento modificabile; nomina/fine Capo protette da `people:appoint`.
- **Capo Admin:** propri admin in sola lettura; scoping nel backend, non filtro solo browser.
- **Teams:** membri e Lead; il Lead gestisce soltanto i membri del proprio team.
- **La mia area:** propria scheda e ruoli con stato, senza funzionalità Soci/censimento riattivate.
- **Linking:** inviti, link manuale e collegamenti recenti; nessuna coda di matching.

Riutilizzare da #132 solo valori profilo mancanti («—») e nome Design & Marketing; da #136 la rimozione
Telegram se non già nel cleanup. **Non mergiare quelle PR**: #146 le considera superate, come backend#99.

## 7. Import persone

[Backend#103](https://github.com/PoliNetworkOrg/backend/issues/103) e
[admin#141](https://github.com/PoliNetworkOrg/admin/issues/141): CSV template → upload → anteprima con errori,
duplicati e incarichi non autorizzati → commit esplicito → eventuali inviti. Non è import censimento.
Il vecchio wizard può fornire componenti da recuperare dalla storia, eliminando i passaggi di campagna.
Non collegare account per contatto o nome durante l'import. Verificare idempotenza e delega anche al commit.

## 8. Fase 2: Soci separati

#144 richiede **design prima dello sviluppo**. Soci deriva da Entra; object ID identifica il socio e `employeeId`
il numero. Nessuna condivisione con record People, nessun claim del tesseramento o match necessario.
Ammissione soci in Azure con `azure:members:create`; la fase 2 non crea un secondo workflow account.

Quote, annualità, stato rinnovo, ricevute bonifico, ricevute numerate e firma possono riusare idee da #100,
non il vecchio contratto. Definire separatamente identificazione storica, importi, numerazione, correzioni,
firmatari, prove di pagamento, mail, retention e catalogo (`soci:*` soltanto un esempio di namespace).
Non ripristinare i vecchi permessi `people:members:*`, `people:fees:*`, `people:receipts:*`.

## 9. Fase 3: censimento admin

#145 richiede design dopo la fase 1. Le persone collegate rispondono in dashboard; le altre ricevono un invito.
La risposta «lascio» termina l'incarico admin con lo stesso comando Auth già usato in fase 1.
Definire calendario, solleciti, risposte tardive/correzioni, mancata risposta e informative. Non dedurre ruoli
da dichiarazioni sui gruppi o dallo status socio. Candidature e colloqui HR restano un processo distinto.

## 10. Verifiche e ordine

Cleanup: admin → backend → permessi IdP. Fase 1: Auth → setup → backend → rispettiva UI.
Review People sospese secondo #146 finché le sottoissue non riaprono il percorso.

Testare pending/linked, ogni stato incarico, autoassegnazione, bounded delegation, Lead e Capo fuori ambito,
account senza permessi che accetta invito, email diverse, token scaduto/riusato/revocato, conflitti di account,
revoca all'unlink, retry e outage Auth. Le prove finali usano backend/Auth reali in staging; agent mode serve alla UI.

`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build`; desktop/mobile e permessi limitati.
Nessuna nuova scelta di retention o visibilità dei contatti è approvata da questo documento: va decisa con
i responsabili. Non ampliare i campi raccolti recuperando automaticamente tutti quelli del vecchio Forms.
