# PRD — Admin Dashboard PoliNetwork

**Versione:** 4.0 · **Aggiornamento:** 16 novembre 2026 · **Stato:** proposta di prodotto aggiornata per revisione.

Documenti: [classificazione e prossime attività](PRD_Classificazione_Feature.md), [MVP](MVP.md),
[People](Persone_Volontari_Soci.md), [permessi](RBAC_Ruoli_Permessi.md),
[design IdP](IdentityProvider_Design.md), [modello dati](IdentityProvider_DataModel.md),
[checklist sito](Checklist_Sito_Web.md).

## 0. Scopo e metodo

Dare al team una base attuale per decidere e assegnare il lavoro. Prima gli strumenti interni, poi i servizi
per soggetti esterni. Questa revisione sostituisce le ipotesi di agosto–ottobre, in particolare il registro
unico persone/soci/censimento e i collegamenti automatici delle identità.

**Presente in main** significa codice integrato, non deploy o collaudo certificato. **In PR** significa lavoro
non integrato. **Da progettare** significa che il requisito non è un contratto da implementare subito.
Le decisioni People del 29 ottobre in [admin#146](https://github.com/PoliNetworkOrg/admin/issues/146)
prevalgono sui vecchi documenti e sulle descrizioni delle PR #132/#136. Le fonti fissate sono in §20.

### 0.1 Stato attuale

- OIDC/BFF, permessi puntuali, shell, overview, Telegram, WhatsApp, etichette, report e CMS sono in main.
- eSign generico è integrato: CIE locale, più firmatari/documenti, OneDrive e consegna email.
- Cleanup People #147, record/incarichi #148 e inviti/link #149 sono integrati; Auth#73 e backend#105/#106/#109
  implementano binding e sincronizzazione. L'import CSV generale non è presente; admin#153 propone un seed una tantum.
- Soci ha un dominio separato `soci.*`: registro/ammissione #158–#161, quote e area personale #163 in main.
  Censimento resta mockup. Decadenza e cancellazione account sono ancora requisiti, non procedure disponibili.
- Microsoft 365 è interamente in sola lettura. Ammissione e cambio numero sono passati a Soci;
  backend#127 ha rimosso `azure.members.create` e `setAssocNumber`.
- Regolamenti #150/#151 e backend#110–#117/#133/#134 sono integrati: editor collaborativo LaTeX,
  PDF, diff, merge, iter di approvazione, emanazione e notifiche.
- Matricole è modificabile da admin e letto da web. Documenti pubblici: backend#132 integrata,
  admin#162 e web#220 aperte. Il lockfile admin risolve ancora `@polinetwork/backend` 4.0.0:
  non equivale alla versione corrente del servizio backend.
- Backend rifiuta chiamate anonime; web usa il proprio token. Nessun rollback `LEGACY_ANONYMOUS=allow`.

## 1. Persone, ruoli e gerarchie

Socio, Group Admin e membro di team sono categorie indipendenti. Essere admin di un gruppo Telegram non
costituisce la fonte dei ruoli organizzativi. Telegram collegato non è necessario per entrare nella dashboard.

La direzione approvata in #146 separa:

1. **People:** Group Admin, Capo Admin e membri/Lead dei team, collegati ai ruoli Auth.
2. **Soci:** utenti Entra ID, quote e rinnovi, separati dai record People.
3. **Censimento:** conferma periodica degli admin, costruita dopo la fase 1.

Una persona non collegata vive soltanto nel backend. Nessun utente preliminare in Auth, nessun matching
per nome, email o Telegram. Sono previsti solo invito accettato e collegamento manuale autorizzato.

## 2. Fondamenta

### 2.1 Autorizzazione

Implementata: `me.access`, permessi esatti, middleware BFF e controllo indipendente nel backend.
`/dashboard` ammette `admin:access` oppure `people:self`; quest'ultimo apre la vista limitata.
Un’assegnazione o delega Regolamenti consente inoltre il solo accesso alle Bozze, verificato dal backend.
In main gli incarichi delle schede collegate sono sincronizzati con Auth; quelli senza account restano pending.

Implementati in Auth#73: binding predeterminati `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`.
Auth controlla delega, autorizzazione corrente e divieto di autoassegnazione. Ruoli con permessi `idp:*`
non sono associabili a People. Un Lead può gestire i membri del proprio team, senza promuovere Lead.
Il Capo Admin consulta i propri admin; la loro gestione resta futura.

### 2.2 Audit amministrativo

L'audit RBAC di Auth e quello di moderazione non sono un registro unificato già disponibile in admin.
Filone aperto: [auth#76](https://github.com/PoliNetworkOrg/auth/pull/76) registra `audit:read`,
[backend#90](https://github.com/PoliNetworkOrg/backend/pull/90) registra le mutazioni e offre `audit.list`,
[admin#123](https://github.com/PoliNetworkOrg/admin/pull/123) aggiunge la pagina.

Accettazione: ricerca e filtri per attore, oggetto, azione, esito e periodo; dettaglio prima/dopo dove raccolto;
sola lettura; nessun segreto o contenuto dei file nei log. Verificare la copertura degli eventi Auth:
il middleware backend da solo non dimostra che le modifiche avviate nell'IdP compaiano nella vista comune.

### 2.3 Ricerca

La palette ⌘K esiste: naviga alle sezioni e avvia ricerche tramite `?q=`. Una ricerca unica che restituisca
record di più domini resta futura; non ricostruire la palette per implementarla.

### 2.4 Overview

Conteggi, segnalazioni, grant e andamento della creazione utenti Telegram sono implementati secondo i permessi.
Quest'ultimo non misura utenti attivi o audience. Indicatori aggregati People/quote restano un incremento da definire sui domini attuali.

### 2.5 Consensi

La prima iterazione People non costituisce il contratto corrente né certifica un processo definitivo di informative,
consensi versionati e retention. Il cleanup ha tolto i flussi collegati al censimento. Progettare il processo futuro
con testi, prova di accettazione, revoca e destinatari prima di collegarlo a eSign. Una firma PDF generica non
completa da sola il processo privacy.

### 2.6 Identity Provider

Auth è autonomo; admin è un consumer OIDC con sessioni Redis dedicate e token solo server-side.
Google/Entra, passkey, Telegram collegato e verifica studente vivono nell'IdP. Socio/Direttivo derivano da Entra.
Il sito usa credenziali di servizio per le letture: questo non è login personale dei visitatori.
Non ricostruire autenticazione o RBAC dentro admin.

### 2.7 eSign

La firma CIE passa dall'app locale: il PIN resta nella sua pagina, mai nel BFF. Da telefono/tablet si consulta;
la firma richiede computer e lettore. La dashboard non permette upload di un PDF firmato altrove nel flusso generico.
Riusare viewer, compositore, firma multipla e gestione drive. Il ponte ricevute People è stato rimosso; il design Soci del 9 novembre esclude ricevute associative e firma CIE.
Prima di dichiarare il servizio operativo, raccogliere evidenza di configurazione Graph/drive, permessi,
installazione dell'agent e firma con CIE reale sui sistemi supportati ([tracker](docs/esign/TRACKER.md)).

## 3. People: fase 1 integrata e import residuo

La roadmap [#146](https://github.com/PoliNetworkOrg/admin/issues/146) resta il riferimento di separazione dei domini.
Cleanup #147, ruoli #148 e collegamenti #149 sono in main con Auth#73 e backend#105/#106/#109.
[Specifica e stato dettagliati](Persone_Volontari_Soci.md).

Le schede richiedono nome/cognome; incarichi `pending`, `sent`, `applied`, `refused` distinguono attesa e rifiuto.
Invito e link manuale sono gli unici collegamenti; `/people/invite` è fuori dalla shell protetta.
Non creare placeholder Auth o ripristinare matching, merge identità e tracciamento gruppi Telegram.
Restano import CSV generale (#141/backend#103), seed una tantum in PR #153 e collaudo dei binding nell'ambiente target.
Il seed non sostituisce il workflow CSV con preview e commit, e questa revisione non lo esegue.

## 4. Governance e Regolamenti

Regolamenti è ora un'area implementata (admin#150/#151), inizialmente per la Raccolta dei Regolamenti Interni.
Comprende bozze, assegnazioni viewer/commenter/editor, collaborazione CodeMirror/Yjs, PDF, commenti, storico,
differenze, merge, approvazione, emanazione tramite GitHub App e notifiche Soci con copia a Direttivo/Probiviri.
Auth#82 aggiunge Presidente e Segretario. Permessi e deleghe sono descritti nel documento RBAC.

Verificare worker LaTeX isolato, servizio collab, repository legal, GitHub App e destinatari prima del rilascio operativo.
L'editor seleziona i file esistenti ma non li aggiunge/rinomina/elimina. Non estendere automaticamente il supporto
allo statuto. Fonte implementativa: [Regolamenti](docs/regulations/README.md).

## 5. Admin e Capo Admin

Pagine ricostruite in #148 sui ruoli Auth e sulla relazione «Capo di riferimento»; nessuna dipendenza dai gruppi Telegram.
Il Capo consulta solo i propri admin; gestione e approvazione ingressi restano fuori scope.
Verificare lo scoping anche chiamando il backend direttamente.

## 6. Soci e quote

Il [design approvato il 9 novembre](docs/people/soci.md) sostituisce le ipotesi precedenti della fase 2 #144.
Entra è fonte dell'appartenenza corrente; object ID collega il registro e `employeeId` conserva il numero.
`soci:read` / `soci:write` sono attivi. Registro, ammissione, registrazione soci Entra esistenti, modifica dati e numero
sono integrati; Microsoft 365 non offre più scritture.

Quote: 5 euro, annualità settembre–agosto, scadenza rinnovo 31 dicembre ed esenzione dell'annualità successiva
per ammissioni giugno–agosto. Il socio carica la prova bonifico PDF/PNG/JPEG (10 MB); il Direttivo conferma,
rifiuta con motivo o segna pagato manualmente. My area funziona anche senza scheda People, tramite `people:self`
e object ID Entra nello snapshot Auth#86. Nessuna ricevuta associativa numerata o firma CIE in questa fase.

Backend#129 e admin#163 implementano quote e self-service; backend#130 compleanni e template italiani.
Decadenza automatica, cessazione/ripristino e coda cancellazione account restano da implementare: compaiono nel design,
ma non nel router corrente. Non dichiarare attivo `SOCI_AUTO_LAPSE` sulla sola base della specifica.

## 7. Team

UI, vista Lead, binding e stati degli incarichi sono in main. Chiavi del contratto People:
`it`, `hr`, `design` (Design & Marketing), `intl`, `events`. Un ruolo senza binding non è assegnabile.
Il Lead gestisce i membri del proprio team, non promuove Lead. Il catalogo pubblico del sito non determina i binding.
Tool specifici dei team restano backlog.

## 8. Censimento e onboarding

[Fase 3 #145](https://github.com/PoliNetworkOrg/admin/issues/145): design necessario dopo la fase 1.
Chiede ai Group Admin se continuano; chi non è collegato riceve prima un invito. L'uscita usa lo stesso
comando di revoca ruolo della fase 1. Il vecchio wizard Forms non è il contratto futuro.
Candidature, colloqui HR, richieste ai gruppi e firma dei documenti restano processi da definire separatamente.

## 9. Email di compleanno

Backend#130 ha implementato job e template italiani per i soci attivi, indirizzati alla casella PoliNetwork.
Verificare dati di nascita, pianificazione, outbox e recapito nell'ambiente target; non aggiungere date alla scheda
People per questa funzione e non equipararla a una newsletter.

## 10. FAQ

CRUD bilingue e categorie sono presenti. Matricole seleziona cinque FAQ dal catalogo.
Import da file e popolamento editoriale restano da fare; riordino e bozza/pubblicazione sono estensioni
future da validare anche sul contratto backend, non blocchi automatici del lancio.

## 11. Aree operative e CMS

- **Telegram/WhatsApp:** gruppi, visibilità, etichette e pubblicazione sono presenti. Telegram non crea gruppi
  dalla dashboard. Grant attivi/programmati esistono; storico completo e reminder restano backlog.
- **Microsoft 365:** directory (`azure:members:read`) e gruppi (`azure:groups:read`) in sola lettura.
  Ammissione e cambio numero passano da Soci con `soci:write`; niente gestione libera di utenti/licenze/membership.
- **Matricole:** risorse, hub Telegram, cinque FAQ e tab Guida; vecchio URL guide rediretto.
  Titoli/struttura restano fissi. Verificare il ciclo admin → backend → web con dati effettivi.
- **Progetti/associazioni:** CRUD interno disponibile. Risorse per piattaforma: backend#72 ancora aperta,
  poi servono editor admin e lettura web. Non confondere questo con il singolo link progetto esistente.

## 12. Associazioni partner

Backlog dopo il lavoro interno: referenti multipli, ownership dell'organizzazione, richieste di creazione/modifica,
approvazione editoriale e pubblicazioni sui canali. Il CRUD interno non offre accesso esterno scoped.
Definire isolamento dei record e successione dei referenti, senza trasferire account personali.
Canali (Telegram/WhatsApp), crediti e responsabilità di approvazione restano da concordare.

## 13. Eventi / PoliTamTam

Backlog: inserimento da partner o PoliNetwork e approvazione prima della pubblicazione.
Dipende dal design di ownership e revisione dei contenuti; non è parte del MVP interno.

## 14. Aziende

Da progettare con un referente di prodotto; nessun incremento assegnabile finché manca lo scope.

## 15. Casa e coinquilini

Backlog esterno: definire identità degli inserzionisti, moderazione e ciclo di vita degli annunci.

## 16. Newsletter

Backlog: segmenti, consensi, disiscrizione e invio. Non usare automaticamente contatti People come mailing list.

## 17. Vincoli e verifica

Permessi puntuali su UI/BFF/backend, dati personali limitati allo scopo, nessun token nel client.
Le mutazioni ricaricano i loader prima di chiudere/toast; errore di reload dopo salvataggio non invita a ripetere.
Nessuna azione distruttiva su più righe senza istruzione esplicita dell'utente (AGENTS.md).
La cancellazione dei dati di test pianificata dal cleanup è lavoro della PR backend, non di questi documenti.

Agent mode non prova autenticazione o accesso al backend reale: People usa il fake; gli altri domini possono
ricevere `UNAUTHORIZED` dal backend main. Per integrazioni usare staging con token reali e fixture isolate.
Verificare anche ruoli limitati, desktop/mobile e failure di Auth, non solo l'account con tutti i permessi.
UI admin prevalentemente inglese, Regolamenti in italiano; localizzazione generale IT/EN resta futura.

## 18. Fuori scope del ciclo

Contabilità completa, gateway pagamenti, modifica dello statuto, gestione libera dei gruppi Entra e migrazione
dei dati People di test. MCP admin è un filone separato in [#137](https://github.com/PoliNetworkOrg/admin/pull/137):
OAuth personale e permessi correnti, ancora da integrare e attivare; la firma richiede comunque la persona.

## 19. Decisioni residue e prossimo ordine

1. Collaudare People integrato: binding/delega, inviti senza permessi, link/unlink, revoche e indisponibilità Auth.
2. Revisionare il seed #153 separatamente dall'import CSV generale #141/backend#103; nessun import implicito.
3. Completare il ciclo Soci (cessazione, ripristino, decadenza e cancellazione manuale account) sul design approvato;
   verificare quote, email e identità Entra senza ripristinare le ricevute associative.
4. Collaudare Regolamenti end-to-end con i suoi servizi e permessi; completare gestione file dell'editor.
5. Completare Documenti pubblici (admin#162/web#220), audit e review MCP; collaudo eSign/Matricole separato.
6. Progettare censimento #145, consensi, candidature HR e localizzazione. Lancio web nella checklist dedicata.
7. Concordare partner/eventi, newsletter e casa dopo le priorità interne.

## 20. Fonti della revisione

Snapshot consultato il **16 novembre 2026**: fetch dei main, lettura di codice/contratti e stato GitHub delle PR.
Il merge non certifica il deploy. Non sono state eseguite migrazioni, import o verifiche di produzione.

| Repository                                                                                         | Baseline fissata | Evidenze principali                                                           |
| -------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| [admin](https://github.com/PoliNetworkOrg/admin/tree/e98b2b7acc7ab77f7f8949bbfad9786f5e1ffb91)     | `e98b2b7`        | Route, permessi, contratti People/Soci/Regolamenti, lockfile e test           |
| [backend](https://github.com/PoliNetworkOrg/backend/tree/275f519a81d2d00c873221d4d8fae69c88fee1d6) | `275f519`        | Router People/Soci, schema, job quote/compleanni, Documenti e Regolamenti     |
| [auth](https://github.com/PoliNetworkOrg/auth/tree/9fe232e2bffab154b070f30532cb9e45f68b0ca9)       | `9fe232e`        | Binding People, Presidente/Segretario, object ID Entra e claim permessi array |
| [web](https://github.com/PoliNetworkOrg/web/tree/17f8c5bb10dc9452d9dc6fee49af870c6408c7a3)         | `17f8c5b`        | Stack visuale confluito in #199, header #221, token backend e Matricole       |

Fonti di prodotto: [roadmap #146](https://github.com/PoliNetworkOrg/admin/issues/146),
[contratto People](docs/people/contract.md), [design Soci](docs/people/soci.md),
[Regolamenti](docs/regulations/README.md). Il design Soci include ancora operazioni future: confrontarlo con
`src/features/soci/soci.contract.ts` e il router backend, non trattarlo come elenco di API già disponibili.

Inventario PR nella [classificazione](PRD_Classificazione_Feature.md) e nella [checklist web](Checklist_Sito_Web.md).
I documenti storici `docs/people/fees.md` non prevalgono sul design Soci del 9 novembre; alcune note README e
contratto People sui mockup restano storiche. Solo Censimento è ancora mockup nella baseline admin.
Bot, legal, polinet.cc, aule e altri repository non sono stati riesaminati: i riferimenti non attestano il loro deploy.
Questa PR incorpora main e modifica soltanto gli otto documenti di pianificazione rispetto a quella baseline.
