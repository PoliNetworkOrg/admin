# PoliNetwork Admin — report feature e roadmap

Data analisi: 19 agosto 2026  
Repository analizzato: `admin`, branch `main`

## Sintesi esecutiva

Il progetto è una buona base per una console operativa: autenticazione con passkey, collegamento Telegram, ruoli, server functions protette, dashboard React/TanStack Start, gestione Telegram, Microsoft 365 e contenuti web. Oggi però è soprattutto un pannello tecnico diviso per integrazione; non è ancora il sistema centrale per gestire l’associazione.

Il vuoto più importante è il censimento. `Azure members` oggi rappresenta utenti Entra/Microsoft 365 con un numero associativo, mentre `Telegram users` rappresenta profili Telegram: manca un’anagrafica associativa canonica che colleghi persona, iscrizione, rinnovo, consensi, ruoli, team, attività e identità esterne. Anche la home è un indice di link statici, non un centro di controllo: non mostra KPI, scadenze, anomalie, attività recenti o cose da fare.

La direzione consigliata è:

1. stabilizzare la base tecnica e separare lettura/scrittura;
2. costruire il censimento come dominio principale;
3. trasformare la home in una command center con alert e workflow;
4. collegare Telegram, Azure e sito alla scheda unica del socio;
5. aggiungere governance, comunicazioni, contenuti e operatività interna.

## Stato attuale verificato

### Stack e fondamenta

- React 19, TanStack Start/Router, Vite, Nitro, Tailwind CSS v4 e shadcn/ui (`README.md`).
- Backend tipizzato tramite tRPC e `@polinetwork/backend` (`src/lib/api/types.ts`).
- Server functions con middleware di sessione e autorizzazione (`src/server/auth.middleware.ts:51-66`).
- Autenticazione con Better Auth, passkey, sessioni attive e link Telegram (`src/features/account`, `src/features/onboarding`).
- Validazione Zod, toast, conferme sulle azioni distruttive, optimistic update in alcune pagine e test di sicurezza (`tests/server-security.test.mjs`).

### Moduli presenti

| Area | Cosa esiste oggi | Gap principale |
| --- | --- | --- |
| Overview | Sei card di accesso alle aree operative (`src/features/dashboard/overview-page.tsx:6-119`) | Nessun dato aggregato, alert, task o stato integrazioni |
| Telegram users | Lista, ricerca, profilo, ruoli, amministratori di gruppo, messaggi recenti, audit Telegram, grant | Nessuna anagrafica associativa collegata; paginazione/search lato server assente |
| Telegram groups | Elenco, tag, invito, visibilità, uscita dal gruppo | Mancano ciclo di vita, ownership, health check, metriche e storico |
| Telegram grants | Grant attivi e programmati, creazione e interruzione | Nessuna vista storica/archivio, reminder o approvazione |
| Microsoft 365 members | Elenco utenti Entra, numero associativo, licenze visibili, creazione account | Non è un vero registro soci; licenze non gestibili dalla UI |
| Microsoft 365 groups | Elenco gruppi e aggiunta/rimozione membri | Nessun access review, owner, gruppo orfano o drift detection |
| Web associations | CRUD bilingue, logo e dieci link pubblici (`src/features/associations/associations-page.tsx:144-200`) | È il catalogo pubblico delle associazioni, non il censimento dei membri |
| Web projects | CRUD bilingue, categorie, logo, link e drag-and-drop | È contenuto pubblico, non project management interno |
| Freshman guide | Upload, versione, data, download e delete PDF | Manca workflow di bozza/approvazione, preview, storico editoriale e reminder |
| Account | Profilo, passkey, sessioni, identità Telegram e ruoli | Mancano preferenze, notifiche e centro sicurezza amministrativo |

### Capacità del backend già sfruttabili

Il contratto tRPC installato espone già alcune superfici che non sono ancora raggiunte dalla navigazione della dashboard:

- FAQ bilingui complete: categorie, creazione, modifica e cancellazione (`node_modules/@polinetwork/backend/dist/index.d.ts:1119-1237`).
- Composizione del direttivo (`tg.permissions.getDirettivo`), verifica gruppo, assegnazione ruoli e `canAddBot` (`.../index.d.ts:311-404`).
- Ricerca gruppi Telegram per testo, tag, invite link e ID (`.../index.d.ts:165-228`).
- Ultima guida disponibile (`web.guides_matricole.getLatestGuide`) (`.../index.d.ts:1378-1414`).
- Messaggi cifrati e audit Telegram, già utilizzati in parte nel profilo utente (`src/features/telegram/users.functions.ts:61-84`).
- Gestione grant attivi e schedulati, ma non un endpoint storico (`.../index.d.ts:704-827`).
- Directory Azure, numero associativo e membership dei gruppi (`.../index.d.ts:827-925`).

Queste API permettono di realizzare rapidamente FAQ, centro direttivo, health check Telegram e widget “ultima guida”. Il censimento, invece, richiede un nuovo dominio dati o un’estensione del backend.

## Diagnosi prodotto

### 1. Manca un’entità persona centrale

Il progetto ha tre rappresentazioni separate della stessa possibile persona:

- Telegram: `id`, nome, username, ruoli e appartenenze;
- Microsoft 365: `id`, mail, nome, `employeeId`, `isMember`, licenze;
- account admin: identità Better Auth e Telegram collegato.

Non c’è una relazione esplicita e auditabile tra questi record. Il numero associativo viene gestito dentro Azure (`src/features/azure/azure.functions.ts:19-42`), ma un socio non dovrebbe dipendere dall’esistenza di un account Microsoft 365.

### 2. La home non aiuta a decidere cosa fare

`DashboardOverviewPage` mostra aree navigabili e descrizioni statiche (`src/features/dashboard/overview-page.tsx:51-119`). Per un’associazione la prima schermata dovrebbe rispondere a domande operative:

- quanti soci sono attivi e quanti stanno per scadere;
- chi non ha completato il profilo o il consenso;
- quali account Telegram/Azure non sono riconciliati;
- quali grant stanno per terminare;
- quali gruppi sono senza membri o senza owner;
- quali contenuti sono da revisionare;
- quali azioni recenti richiedono attenzione.

### 3. Autorizzazione ancora globale

Su `main` l’accesso è concesso a `owner`, `direttivo` e `president`, mentre `creator` è escluso (`src/server/authorization.ts:1-9`). Tutte le mutazioni usano il medesimo `adminMiddleware`; non esiste una matrice per modulo o operazione (`src/features/telegram/users.functions.ts:87-116`, `src/features/azure/azure.functions.ts:19-58`).

È già presente una branch remota `origin/agent/hr-dashboard-read-only` che introduce l’idea corretta di ruolo HR in sola lettura. Va portata a un modello stabile e granulare prima di esporre dati personali del censimento.

### 4. I dati sono caricati spesso tutti in una volta

Le pagine chiamano `getAll` e filtrano/smistano principalmente nel browser. È comodo per il prototipo, ma diventa fragile con molti soci, gruppi e messaggi. Il censimento deve nascere con query server-side, filtri URL, paginazione reale, ordinamento e autorizzazione per campo.

### 5. CMS pubblico e gestione interna sono ancora mescolati

`Web projects` è un catalogo di contenuti pubblici con categorie `news`, `general`, `deprecated`, non un sistema per seguire attività, responsabili e scadenze interne. Conviene mantenere separati:

- Content management: associazioni pubbliche, progetti pubblici, FAQ e guide;
- Operations: iniziative, task, eventi, volontari e responsabilità.

## Feature prioritarie

### P0 — fondamenta necessarie prima di allargare la dashboard

#### Autorizzazione per capacità

Passare da “admin sì/no” a permessi per modulo e azione:

- `members.read`, `members.write`, `members.export`;
- `telegram.read`, `telegram.moderate`, `telegram.grants`;
- `azure.read`, `azure.members.write`, `azure.groups.write`;
- `content.read`, `content.write`, `content.publish`;
- `governance.read`, `governance.write`;
- `audit.read`, `settings.write`.

Prevedere ruoli composti, per esempio `HR` read-only sui soci, `Content editor`, `Telegram moderator`, `Finance`, `Board member` e `Owner`. Le azioni ad alto impatto — cancellazioni, assegnazione ruoli, rimozione da gruppi, export dati — dovrebbero mostrare permesso richiesto, anteprima e conferma esplicita.

#### Audit amministrativo unificato

Creare un audit log per ogni modifica, indipendente dall’audit di moderazione Telegram:

- attore, ruolo, data, IP/sessione;
- oggetto e valori prima/dopo;
- motivo obbligatorio per azioni sensibili;
- esito, errore e correlation ID;
- filtri per persona, modulo, azione e intervallo;
- export riservato e retention configurabile.

#### Ricerca globale e centro notifiche

Una command palette `⌘K`/`Ctrl+K` per cercare soci, utenti Telegram, gruppi, account Azure, FAQ e contenuti. Un centro notifiche dovrebbe raccogliere scadenze, errori di sincronizzazione, richieste in attesa, grant in scadenza e assegnazioni da completare.

#### Health check integrazioni

Card e pagina “Integrations” con ultimo sync, latenza, ultimo errore, contatori e azione retry per Telegram, Microsoft 365, Better Auth e sito. Il backend ha già endpoint utili per alcune verifiche; i problemi non dovrebbero apparire solo come toast dopo un click.

### P1 — Censimento soci: il dominio centrale

#### Anagrafica canonica

Creare una sezione `/dashboard/association/members` con una tabella filtrabile e una scheda dettaglio `/dashboard/association/members/:memberId`.

Campi consigliati per l’MVP:

| Blocco | Dati |
| --- | --- |
| Identità | nome, cognome, nome visualizzato, email principale, telefono opzionale |
| Identificativo | ID interno, numero tessera/associativo univoco, eventuale codice fiscale solo se realmente necessario |
| Stato | prospect, richiesta, attivo, sospeso, scaduto, ex socio, archiviato |
| Iscrizione | data ingresso, anno/periodo associativo, data scadenza, tipo di iscrizione, stato rinnovo |
| Profilo associativo | università, corso, sede/città, anno di studio, competenze, lingue, interessi, disponibilità |
| Relazioni | team, ruolo interno, responsabile, progetti, eventi, turni e attività |
| Integrazioni | Telegram ID/username, Azure user ID, email Microsoft, gruppi, licenze, ultimo sync |
| Compliance | consensi separati, data consenso, fonte, revoca, note operative, ultima modifica |

Evitare di trasformare il censimento in un contenitore indiscriminato di dati personali: ogni campo deve avere uno scopo, un responsabile e una retention.

#### Workflow di iscrizione e rinnovo

- richiesta di iscrizione con stato `pending`;
- checklist di verifica e approvazione da parte dell’HR/direttivo;
- assegnazione automatica del numero associativo;
- periodo di validità e reminder 30/15/7 giorni prima della scadenza;
- rinnovo, sospensione, uscita e riattivazione con storico;
- email/Telegram di benvenuto e conferma;
- badge visivo “profilo incompleto”, “consenso mancante”, “integrazione non collegata”.

#### Importazione, deduplicazione e merge

Import CSV con:

- mapping delle colonne;
- dry-run prima del salvataggio;
- anteprima di nuove righe, aggiornamenti, duplicati ed errori;
- matching per email, numero associativo, Telegram ID, Azure ID e nome normalizzato;
- merge assistito con confronto campo per campo;
- report scaricabile per riga.

Le operazioni massive devono sempre avere preview e conferma, senza cancellazioni implicite.

#### Scheda socio 360°

La pagina dettaglio dovrebbe riunire in un’unica timeline:

- dati anagrafici e stato iscrizione;
- rinnovi e pagamenti, se il modulo economico viene attivato;
- identità Telegram/Azure e stato sincronizzazione;
- ruoli e gruppi;
- progetti, team, eventi e presenze;
- comunicazioni e notifiche inviate;
- documenti e consensi;
- audit completo delle modifiche.

### P1 — Dashboard command center

Sostituire la home a card statiche con una pagina composta da widget configurabili per ruolo:

1. **Soci**: attivi, nuovi, in scadenza, da rinnovare, incompleti.
2. **Riconciliazione**: Telegram non collegati, Azure senza numero, duplicati sospetti.
3. **Accessi**: licenze assegnate, gruppi con accesso anomalo, utenti inattivi.
4. **Telegram**: grant attivi/in scadenza, gruppi nascosti, gruppi senza owner, errori bot.
5. **Contenuti**: FAQ/guide da pubblicare, contenuti obsoleti, link rotti.
6. **Attività recenti**: ultime modifiche con filtri e link diretto.
7. **Integrazioni**: stato e ultimo aggiornamento di ogni servizio.

Ogni KPI deve essere cliccabile e portare a una lista già filtrata. Aggiungere quick action per “Nuovo socio”, “Importa soci”, “Cerca persona”, “Crea grant”, “Apri richieste” e “Controlla sincronizzazione”.

### P1 — Riconciliazione identità e sincronizzazione

Creare una pagina `Integrations → Reconciliation` che confronti il registro canonico con Telegram e Microsoft 365:

- persona presente nel censimento ma non in Azure;
- account Azure senza socio corrispondente;
- Telegram username cambiato o account non collegato;
- numero associativo duplicato o incoerente;
- licenza assegnata a ex socio;
- membro di un gruppo senza ruolo o team compatibile;
- record che richiedono merge manuale.

Per ogni differenza: motivo, confidence del matching, proposta di correzione, preview e azione manuale. In una fase successiva si può aggiungere sync automatica con regole approvate.

### P1 — Governance e ruoli associativi

Il backend espone già `getDirettivo`, ma manca una sezione amministrativa. Aggiungere:

- composizione del direttivo e degli organi;
- incarico, data inizio/fine e sostituto;
- responsabili di team e deleghe;
- matrice ruoli/permessi della dashboard;
- storico delle nomine e revoche;
- registro decisioni, verbali e action item;
- agenda riunioni, quorum, votazioni e scadenze;
- approvazione a due persone per azioni sensibili.

Una buona regola è distinguere sempre ruolo associativo, ruolo Telegram e permesso tecnico della dashboard: non devono essere sinonimi.

### P1 — Comunicazioni e notifiche

- Template bilingui per benvenuto, rinnovo, scadenza e cambio stato.
- Invio email e Telegram con anteprima, destinatari, variabili e log di consegna.
- Segmenti salvati: soci attivi, ex soci, team, corso, sede, gruppo Telegram.
- Digest giornaliero/settimanale per direttivo e HR.
- Preferenze personali e opt-out dove applicabile.
- Coda notifiche fallite con retry e motivo dell’errore.

## Feature per area già presente

### Telegram

#### Moderation center

Trasformare il profilo utente e l’audit in una console di moderazione completa:

- coda di segnalazioni e casi;
- ban, unban, kick, mute e unmute con durata, motivo e storico;
- azioni di gruppo con conferma e limite di sicurezza;
- ricerca messaggi e contesto conversazionale;
- filtri per gruppo, gravità, stato e moderatore;
- link diretto al messaggio e prova dell’azione;
- analytics su volume, utenti attivi, segnalazioni e tempi di risposta.

Il contratto backend contiene già i tipi di audit `ban`, `unban`, `kick`, `mute`, `unmute`, `ban_all` e `unban_all`: il passo mancante è costruire workflow e UI sopra questi eventi.

#### Gruppi e bot

- creazione/import di gruppi con validazione titolo, tag e invite link;
- controllo link rotto, gruppo nascosto, gruppo senza membri e gruppo senza amministratore;
- owner/responsabile operativo e data di ultima revisione;
- rotazione inviti e gestione ciclo di vita;
- check `canAddBot` e pagina salute del bot;
- statistiche per gruppo e ultimo messaggio;
- aggiornamento live tramite WebSocket/SSE, se il backend `WS_PATH` viene adottato.

#### Grants

- storico completo, inclusi terminati e interrotti;
- calendario e vista timeline;
- grant in scadenza e reminder automatici;
- approvazione da parte del direttivo;
- motivazione obbligatoria, allegati e log di invio Telegram;
- ricerca per richiedente, autorizzatore, gruppo e periodo;
- endpoint backend storico dedicato: oggi il contratto espone solo `getOngoing` e `getScheduled`.

### Microsoft 365 / Azure

- dashboard licenze: assegnate, inutilizzate, mancanti e a rischio;
- assegnazione/revoca licenze con permesso dedicato e audit;
- account inattivi e gruppi senza owner;
- access review periodico per gruppo;
- richieste di accesso con approvazione;
- onboarding guidato: crea socio → crea account → assegna numero → aggiunge gruppi → invia welcome mail;
- offboarding: blocca accessi, rimuove gruppi, revoca licenze, conserva audit;
- mapping diretto tra membro canonico e oggetto Entra;
- export report di conformità.

La UI attuale visualizza `assignedLicensesIds`, ma il contratto disponibile espone mutazioni per numero associativo e membership gruppi, non per gestione licenze: per quest’ultima serve un’estensione backend/Graph API.

### Web e contenuti

#### FAQ

Aggiungere `Web → FAQs`: è la feature con il miglior rapporto valore/dipendenza perché il backend espone già categorie e CRUD bilingue. MVP:

- categorie con titolo e icona;
- domanda/risposta IT e EN;
- ricerca e filtro per categoria;
- ordinamento drag-and-drop;
- anteprima pubblica;
- stato bozza/pubblicata e storico modifiche.

#### Workflow editoriale

- draft, review, approvazione e publish;
- ruoli editor/reviewer/publisher;
- preview prima della pubblicazione;
- versioni e rollback;
- scheduling per data/ora;
- checklist lingua IT/EN, immagini e link;
- link checker e report contenuti obsoleti;
- metadata SEO, slug, social preview e canonical URL;
- cronologia “chi ha cambiato cosa”.

#### Guide e associazioni pubbliche

- preview PDF e indicazione della versione attualmente pubblicata;
- deprecazione invece della cancellazione definitiva;
- conteggio download e file sostitutivo;
- stato pubblico/nascosto e data revisione;
- validazione automatica dei link social;
- scheda associazione con owner interno, contatti di riferimento e stato verifica;
- approvazione a due step per contenuti pubblici.

### Operatività interna

Da tenere separata dal catalogo `Web projects`:

- progetti interni con owner, stato, priorità, scadenza, milestone e task;
- board Kanban e calendario;
- assegnazione a team e volontari;
- commenti, allegati e decisioni;
- eventi con iscrizione, lista partecipanti, presenze e turni;
- gestione sale, attrezzatura e checklist;
- registro ore/attività volontarie;
- report impatto per progetto/evento.

### Amministrazione economica e documentale

Da introdurre quando il flusso associativo è chiaro:

- quote associative e stato pagamento;
- ricevute, fatture, note spese e rimborsi;
- budget annuale per progetto/evento;
- approvazione spese e doppia firma;
- scadenze fiscali e assicurative;
- archivio documenti con versioni, permessi e retention;
- verbali, statuto, contratti e certificazioni;
- export per commercialista e report di bilancio.

Per pagamenti e documenti sensibili è preferibile integrare servizi specializzati invece di costruire una contabilità completa dentro questa dashboard.

## Censimento: proposta tecnica minima

### Entità

```text
Member
├── MembershipPeriod       iscrizione annuale o per periodo
├── MemberIdentity         Telegram, Azure, email e altri provider
├── MemberConsent          consenso, fonte, data e revoca
├── MemberRole              ruolo associativo con periodo di validità
├── MemberTeam              appartenenza a team/progetto
├── MemberDocument          documenti con permesso e retention
├── Payment                 quota/ricevuta, se attivato
└── Activity                eventi, task, presenze e comunicazioni
```

Vincoli indispensabili:

- numero associativo univoco;
- identità esterne univoche quando presenti;
- storico, non sovrascrittura cieca di stato e periodo;
- audit di ogni lettura sensibile e di ogni mutazione;
- permessi a livello di modulo e, se necessario, di campo;
- export del singolo socio e cancellazione/anonymizzazione secondo policy;
- nessun dato sensibile nei log applicativi o nei toast;
- retention configurabile e documentata.

### Flusso MVP

```text
Richiesta → verifica dati → deduplica → approvazione → numero socio
        → collegamento Telegram/Azure → welcome → rinnovo → storico
```

### Acceptance criteria

- Un operatore può creare un socio senza creare prima un account Azure.
- La scheda mostra chiaramente identità locale, Telegram e Azure e segnala i collegamenti mancanti.
- L’import CSV non scrive nulla prima della conferma dell’anteprima.
- Duplicati e conflitti vengono mostrati campo per campo.
- Un HR read-only può consultare solo ciò che il suo ruolo consente e non vede pulsanti di scrittura.
- Ogni cambio di stato, numero, consenso o identità esterna è rintracciabile nell’audit.
- Il socio in scadenza compare automaticamente nella coda di attenzione.
- Nessuna cancellazione massiva è disponibile senza conferma esplicita e riepilogo delle righe coinvolte.

## Miglioramenti UX e frontend

### Navigazione

Aggiungere categorie coerenti:

```text
Overview
Association
  Members / Renewals / Teams
Operations
  Tasks / Projects / Events
Governance
  Board / Meetings / Decisions
Integrations
  Telegram / Microsoft 365 / Reconciliation / Health
Content
  Associations / Projects / FAQs / Guides
Reports
Account
```

### Liste e dettagli

- Filtri, tab, ordinamento e pagina nello URL, così un link conserva il contesto.
- Query server-side e paginazione reale per il censimento e i log.
- Tabelle su desktop, card/row sheet su mobile; evitare che ogni lista richieda scroll orizzontale.
- Colonne configurabili e viste salvate per ruolo.
- Selezione multipla solo dove esiste un caso d’uso reale, sempre con preview e conferma.
- Stati uniformi: loading, empty, error, stale, saving e permission denied.
- Timeline e deep link tra membro, gruppi, ruoli, contenuti e audit.

### Lingua e contenuti

Il contenuto pubblico richiede IT/EN, mentre l’interfaccia amministrativa è quasi tutta in inglese. Decidere una direzione esplicita:

- UI bilingue con preferenza per utente; oppure
- UI italiana per il team associativo, mantenendo IT/EN sui contenuti pubblici.

In entrambi i casi servono messaggi e validazioni non misti e un controllo di completezza linguistica.

### Design system e responsive

L’audit statico `@memi-design/cli@2.7.9 diagnose . --json --no-write --fail-on none` ha prodotto 87/100, con accessibilità 100, componenti 100, visual-system 76, colore 68 e responsive 88. Le evidenze principali sono:

- 9 colori hex rilevati; uno è in `src/styles.css:9` e diversi provengono da CSS compilato in `.output`;
- 82 utility colore;
- 13 dimensioni testo;
- 88 utility di spacing;
- 8 radius e 6 shadow utility;
- 190 valori Tailwind arbitrari;
- 18 route e solo 23 utility responsive rilevate.

Il punteggio è un indicatore, non un gate funzionale: il target include anche `.output`, quindi va ripetuto escludendo gli artefatti generati. Il lavoro consigliato è promuovere colori, radius, shadow e spacing ricorrenti a token semantici e verificare mobile/tablet sulle pagine con tabelle e dialog lunghi. Il feedback dinamico e il recupero da errori non sono completamente valutabili con lo scan statico e richiedono prove interattive.

## Roadmap proposta

| Fase | Obiettivo | Risultato |
| --- | --- | --- |
| 0 — Stabilizzazione | RBAC read/write, audit unificato, health check, query server-side, cleanup file duplicati | Base sicura e osservabile |
| 1 — Censimento MVP | `Member`, periodi iscrizione, stati, lista, dettaglio, import dry-run, deduplica, consensi | Registro soci utilizzabile |
| 2 — Command center | KPI aggregati, attention queue, notifiche, quick actions, riconciliazione Telegram/Azure | Dashboard che guida il lavoro quotidiano |
| 3 — Workflow | richieste, rinnovi, welcome, offboarding, team, ruoli associativi, direttivo | Gestione del ciclo di vita |
| 4 — Content e community | FAQ, workflow editoriale, moderation center, grant history, bot/group health | Copertura completa dei canali esistenti |
| 5 — Operations | task, eventi, volontari, documenti e finanza essenziale | Gestione associativa end-to-end |
| 6 — Automazioni | reminder, sync approvata, digest, report schedulati, anomalie | Riduzione del lavoro manuale |

## Priorità valore/dipendenze

| Feature | Valore | Dipendenza | Priorità |
| --- | --- | --- | --- |
| Censimento soci | Molto alto | nuovo modello/API | P1 |
| Dashboard KPI + attention queue | Molto alto | aggregati censimento | P1 |
| RBAC granulare | Molto alto | policy ruoli | P0 |
| Riconciliazione identità | Molto alto | Member + connettori | P1 |
| FAQ CMS | Alto | backend quasi pronto | P1 |
| Rinnovi/notifiche | Alto | Member + scheduler/email | P1 |
| Audit amministrativo | Alto | schema audit | P0 |
| Azure access review/licenze | Alto | Graph/backend extension | P2 |
| Moderation center | Alto | casi/segnalazioni backend | P2 |
| Governance direttivo | Alto | dati organi/mandati | P2 |
| Eventi e volontari | Medio-alto | calendario/registrazioni | P2 |
| Finanza e documenti | Alto | policy e integrazione dedicata | P3 |
| AI assistant interno | Medio | permessi, audit, privacy, retrieval | P3 |

## Feature “fighe” con valore reale

Da aggiungere dopo il nucleo, non prima:

- tessera socio digitale con QR e validità;
- profilo socio condivisibile solo con consenso;
- mappa dei team, competenze e disponibilità;
- timeline visuale dell’associazione e degli incarichi;
- sincronizzazione con indicatore di drift “prima/dopo”;
- dashboard con widget personalizzabili per HR, direttivo e moderatori;
- report PDF/CSV schedulati inviati al direttivo;
- centro comando da tastiera con azioni rapide;
- rilevazione di duplicati e anomalie con spiegazione del matching;
- preview pubblica dei contenuti con confronto tra versione online e bozza;
- modalità mobile/PWA per check-in eventi e gestione rapida;
- assistant interno limitato ai documenti e ai dati autorizzati, con citazione della fonte e nessuna azione irreversibile autonoma.

## Verifica tecnica eseguita

Comandi eseguiti dopo aver riallineato `node_modules` al lockfile con `pnpm install --frozen-lockfile`:

- `pnpm typecheck` — passato;
- `pnpm test` — 16 test passati;
- `pnpm check` — Biome pulito su 141 file;
- `pnpm build` — build client, SSR e Nitro passato;
- `npx -y @memi-design/cli@2.7.9 diagnose . --json --no-write --fail-on none` — 87/100, 0 critici, 8 finding di design/maintainability/responsive.

Il report non modifica il codice applicativo. L’unica azione locale aggiuntiva è stata l’installazione delle dipendenze già dichiarate nel lockfile, necessaria perché l’ambiente iniziale non aveva `@dnd-kit/react` e aveva una versione precedente del backend.

## Decisioni da prendere prima di implementare il censimento

1. Il numero associativo resta un identificativo Azure o diventa proprietà del nuovo `Member`?
2. L’iscrizione è annuale, semestrale o senza scadenza?
3. Quali dati sono davvero necessari per il tesseramento e quali sono vietati/non pertinenti?
4. HR può leggere tutto o alcuni campi devono essere mascherati?
5. Il pagamento è manuale, bonifico, Stripe o altro?
6. Chi approva iscrizioni, rinnovi, ruoli e cancellazioni?
7. Qual è la policy di conservazione, export e anonimizzazione?
8. I progetti interni devono essere separati dal catalogo pubblico esistente?

La decisione architetturale più importante è la prima: se il nuovo censimento nasce direttamente come registro canonico, tutte le altre feature — dashboard, Azure, Telegram, notifiche, eventi e report — possono costruirsi attorno alla stessa persona invece di aggiungere altre liste scollegate.
