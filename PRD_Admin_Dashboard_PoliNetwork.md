# PRD — Admin Dashboard PoliNetwork

**Documento di prodotto per il Team IT**
**Versione:** 1.0
**Data:** 20 agosto 2026
**Stato:** Bozza per revisione
**Branch/commit di riferimento per l'analisi:** `report/new-feature-roadmap`, con `pnpm install --frozen-lockfile` eseguito per ispezionare il contratto `@polinetwork/backend@0.17.1`.

## 0. Scopo e metodo di questo documento

Questo documento è un **nuovo PRD**, distinto da [`PRD_Admin_Dashboard_Associazione.md`](PRD_Admin_Dashboard_Associazione.md) (v0.2, non modificato). Il vecchio documento resta un riferimento sui bisogni di business espressi dall'associazione, ma **non è usato come fonte di verità tecnica**: ogni funzionalità qui descritta è stata verificata direttamente su:

- il codice del frontend/BFF in `src/` (route, feature, server functions, middleware di autorizzazione);
- il contratto tipizzato del backend reale, `node_modules/@polinetwork/backend/dist/index.d.ts` (unica sorgente di verità su cosa il backend espone oggi via tRPC: router `tg`, `azure`, `web`, `auth`, `test`);
- i test (`tests/server-security.test.mjs`) e la configurazione (`AGENTS.md`, `package.json`, `README.md`).

Dove il vecchio PRD presuppone dati, ruoli o flussi che non esistono nel codice attuale, questo documento lo segnala esplicitamente come **mancante**, propone l'ipotesi minima necessaria per renderlo implementabile, e rimanda le decisioni non deducibili alla sezione **11. Decisioni aperte**.

**Criterio di priorità dichiarato dal Team IT e applicato qui:** le funzionalità interne di PoliNetwork (censimento soci, ruoli e gerarchie, governance, team) hanno priorità sulle aree pensate per soggetti esterni (associazioni partner, aziende, alloggi), **anche dove il vecchio PRD indicava l'ordine opposto**. Questo è il motivo principale per cui la struttura delle priorità in questo documento differisce da quella del documento originale.

---

## 1. Stato reale verificato della piattaforma

### 1.1 Stack e perimetro del repository

- Frontend: React 19, TanStack Start/Router, Vite, server Nitro, Tailwind CSS v4, shadcn/ui, TanStack Table (`package.json`, `README.md`).
- Autenticazione: Better Auth (client in `src/lib/auth.ts`, server in `src/server/auth.server.ts`), con email OTP e passkey (`@better-auth/passkey`).
- Backend: **esterno**, consumato come pacchetto npm tipizzato `@polinetwork/backend` via tRPC (`AppRouter`) più un plugin Better Auth dedicato per il collegamento Telegram. Questo repository **non ha database proprio, non ha job/cron, non ha invio email**: tutta la logica di dominio (utenti Telegram, gruppi, membri Azure, contenuti web) vive nel backend condiviso.
- `AGENT_MODE=true` (solo se `NODE_ENV=development`) sostituisce sessione e ruoli con una sessione fittizia con tutti i ruoli admin, esclusivamente per anteprime locali (`src/server/auth.server.ts:16-44`, `AGENTS.md`). Non ha effetto in produzione.

### 1.2 Autenticazione e onboarding — flusso verificato

1. `/login`: email OTP o passkey (`src/features/auth/login-page.tsx`). Nessuna registrazione self-service: presuppone un account Better Auth già esistente.
2. Dopo il login, `dashboardAccessMiddleware`/`adminMiddleware` (`src/server/auth.middleware.ts`) controllano la sessione:
   - nessun `telegramId` collegato → redirect a `/onboarding/link`, dove l'utente genera un codice temporizzato e lo usa con `/link` sul bot Telegram (`src/features/onboarding/telegram-link-page.tsx`);
   - `telegramId` presente ma nessun ruolo admin → redirect a `/onboarding/unauthorized`;
   - ruolo admin presente → accesso a `/dashboard`.
3. I ruoli non sono un concetto della dashboard: sono **letti in diretta da Telegram** (`backend.tg.permissions.getRoles`), la stessa fonte usata dal bot.

### 1.3 Ruoli e permessi — modello attuale (`src/server/authorization.ts`, contratto `USER_ROLE`)

Il backend Telegram conosce sei ruoli: `admin`, `hr`, `president`, `direttivo`, `creator`, `owner`.

| Ruolo | Accesso dashboard (`ADMIN_ROLES`) | Scrittura dashboard (`WRITE_ADMIN_ROLES`) |
|---|---|---|
| `owner` | sì | sì |
| `direttivo` | sì | sì |
| `president` | sì | sì |
| `hr` | sì | **no — sola lettura** (PR #67) |
| `admin` | **no** | no |
| `creator` | **no, escluso esplicitamente** anche se combinato con altri ruoli | no |

Osservazioni rilevanti per questo PRD:

- **Il ruolo base `admin` — la maggioranza dei collaboratori PoliNetwork — non ha alcun accesso alla dashboard oggi**, indipendentemente da eventuali incarichi come "Capo Admin". Questo è il gap principale rispetto alla sezione 3 del vecchio PRD ("Dashboard Admin e Capo Admin").
- `creator` è escluso per progetto (`hasAdminRole` ritorna `false` se la lista ruoli contiene `creator`), verosimilmente per segregare l'account con pieni poteri sul bot dal pannello web. Va preservato salvo decisione contraria.
- I permessi sono **binari e globali per ruolo**: non esiste granularità per modulo/azione (es. "può leggere i soci ma non modificarli"), né scoping (es. "vede solo gli admin del proprio corso"). `hr` è l'unica eccezione, ed è un blocco di scrittura totale, non selettivo.
- **Non esistono nel backend**: concetto di "corso di studi", "team interno" (IT, Design & Social, International, HR, Events & Partnerships), "Capo Admin", "rappresentante". Sono assenti sia come ruolo Telegram sia come campo dati in qualunque entità esposta dal contratto.

### 1.4 Cosa esiste davvero, area per area

| Area | Percorso | Stato | Dettaglio verificato |
|---|---|---|---|
| Overview | `/dashboard` | **Implementato (minimale)** | Sei card statiche di collegamento alle aree (`overview-page.tsx`). Nessun KPI, alert, scadenza o attività recente. |
| Telegram Users | `/dashboard/telegram/users`, `/users/$userId` | **Implementato** | Elenco (ricerca/paginazione lato client), profilo con ruoli, gruppi amministrati, ultimi messaggi, audit di moderazione, grant. Azioni: assegna/rimuovi ruolo e admin di gruppo, crea/interrompi grant. |
| Telegram Groups | `/dashboard/telegram/groups` | **Implementato** | Elenco, tag, invito, toggle visibilità, uscita dal gruppo con conferma. Manca creazione gruppo, ownership, statistiche, stato del bot. |
| Telegram Grants | `/dashboard/telegram/grants` | **Implementato** | Tab attivi/programmati, creazione/interruzione. Il backend espone solo `getOngoing`/`getScheduled`: **non esiste uno storico** dei grant terminati. |
| Azure Members | `/dashboard/azure/members` | **Implementato** | Elenco con numero associativo (`employeeId`) e licenze, filtro "solo membri", creazione con invio email di benvenuto, modifica numero. Nessuna cancellazione; nessuna gestione licenze (il backend non la espone). |
| Azure Groups | `/dashboard/azure/groups` | **Implementato** | Elenco gruppi, aggiunta/rimozione membri. |
| Web Associations | `/dashboard/web/associations` | **Implementato** | CRUD bilingue IT/EN, logo, 10 link social, editing inline. È la **vetrina pubblica** delle associazioni sul sito, non un'area a cui le associazioni stesse accedono. |
| Web Projects | `/dashboard/web/projects` | **Implementato** | CRUD bilingue, categorie (`news`/`general`/`deprecated`), drag&drop, logo, link. |
| Web Guides | `/dashboard/web/guides` | **Implementato** | Upload/versione/data/eliminazione PDF guida matricole. Manca bozza/approvazione, storico, anteprima pubblica. |
| Account | `/dashboard/account` | **Implementato** | Profilo, identità Telegram + ruoli, passkey, sessioni attive con revoca. |
| Onboarding/Login | `/login`, `/onboarding/*` | **Implementato** | Vedi §1.2. |

### 1.5 Capacità del backend già pronte ma non raggiunte dal frontend

- `web.faqs.*`: categorie e CRUD FAQ bilingue completo — pronto, nessuna pagina.
- `tg.permissions.getDirettivo`: composizione del Direttivo — pronto, nessuna UI di governance.
- `tg.permissions.canAddBot`, `tg.groups.search/getByTag/getByInviteLink` — pronti, non usati.
- `web.guides_matricole.getLatestGuide` — pronto, non mostrato da nessuna parte come "ultima guida disponibile".

### 1.6 Cosa non esiste — né in frontend né nel contratto backend

Nessuna delle seguenti è realizzabile senza nuovo lavoro sul backend condiviso o su un nuovo servizio dati:

- Un'entità **socio/membro associativo** indipendente da Telegram e da Azure. Oggi il numero associativo esiste solo dentro Azure (`azure.members.setAssocNumber`), e presuppone un account Microsoft 365 — un volontario senza account Azure non è "socio" da nessuna parte.
- Stato di iscrizione, rinnovo, scadenza, storico pagamenti.
- Invio email automatico (rinnovo, compleanno, benvenuto oltre a quello già presente per la creazione membro Azure) — non esiste un motore di scheduling/cron in questo repository, che è un frontend/BFF.
- Integrazione WhatsApp (solo Telegram è integrato, in ogni sua parte).
- Eventi delle associazioni / "PoliTamTam".
- Sistema di crediti per le associazioni partner.
- Accesso alla dashboard per le associazioni partner stesse (oggi l'autenticazione presuppone un singolo tipo di utente: un collaboratore interno con ruolo Telegram).
- "Corso di studi", "team interno", "Capo Admin", "rappresentante" come dati.
- Workflow di candidatura/onboarding per nuovi admin.
- Un **audit log amministrativo** che copra le azioni della dashboard stessa (creazione/modifica associazione, assegnazione ruolo, ecc.). Esiste solo l'audit di moderazione Telegram (`ban`/`unban`/`kick`/`mute`/`unmute`/`ban_all`/`unban_all`), che riguarda la moderazione dei gruppi, non le operazioni amministrative sulla piattaforma.

---

## 2. Principi guida di questo PRD

1. **Priorità interna prima che esterna**: censimento, ruoli, governance e team vengono prima di associazioni partner, aziende, alloggi — vedi §0.
2. **Una sola identità persona**: qualunque nuova funzionalità deve collegarsi all'identità esistente (Telegram / Azure / Better Auth), non aggiungere una quarta rappresentazione scollegata.
3. **Continuità del modello di permessi**: qualunque estensione dei permessi deve restare compatibile con `ADMIN_ROLES`/`WRITE_ADMIN_ROLES` e i ruoli Telegram esistenti, introducendo granularità in modo incrementale.
4. **Nessuna azione distruttiva multipla senza anteprima e conferma esplicita** — vincolo permanente da `AGENTS.md`.
5. **Minimizzazione dei dati personali**: ogni nuovo campo su soci/admin deve avere uno scopo dichiarato, un responsabile e un'ipotesi di retention.
6. **Riuso prima di ricostruzione**: dove il backend espone già una capacità (FAQ, Direttivo, ricerca gruppi), si costruisce la UI prima di chiedere nuovo lavoro di backend.

---

## 3. Persone, ruoli, gerarchie e struttura organizzativa

Questa sezione risponde esplicitamente alla richiesta di un'attenzione dedicata a membri, soci, admin, team, gerarchie e permessi.

### 3.1 I tre piani oggi sovrapposti

Nel sistema attuale esiste un solo piano di identità/permesso: il ruolo Telegram. Concettualmente andrebbero distinti tre piani, oggi confusi in uno:

| Piano | Cosa rappresenta | Stato oggi |
|---|---|---|
| Ruolo associativo/organizzativo | Chi sei nell'associazione: socio, admin, Capo Admin, membro del Direttivo, Presidente | **Non esiste come dato**: è implicito nei ruoli Telegram, che però non distinguono "admin semplice" da "Capo Admin" |
| Ruolo/permesso Telegram | Cosa puoi fare nei gruppi gestiti dal bot | Esiste (`USER_ROLE`) |
| Permesso applicativo della dashboard | Cosa puoi vedere/modificare in questa applicazione | Esiste solo come mappatura 1:1 dal ruolo Telegram (`ADMIN_ROLES`/`WRITE_ADMIN_ROLES`) |

**Raccomandazione**: introdurre progressivamente il primo piano come dato del futuro Censimento (§5.2), e permessi applicativi granulari (§5.1.1) sopra — senza necessariamente toccare il piano Telegram, che resta la fonte di verità per la moderazione dei gruppi.

### 3.2 Membri, soci e admin — la distinzione da fissare

Il vecchio PRD usa "socio" (chi versa la quota associativa) e "admin" (chi si occupa operativamente dell'associazione, spesso ma non necessariamente anche socio) come categorie distinte. **Nel codice attuale questa distinzione non esiste**: `AzureMember.isMember` è l'unico flag di appartenenza, e riguarda solo chi ha (o dovrebbe avere) un account Microsoft 365. Un admin senza account Azure non è "socio" in nessuna parte del sistema oggi.

**Ipotesi minima adottata in questo PRD** (da confermare, vedi Decisioni aperte §11):

- Un **Socio** è un record del futuro Censimento (§5.2), indipendente da Telegram e da Azure.
- Un **Admin** è un Socio con un ruolo organizzativo aggiuntivo (Admin, Capo Admin, Direttivo, Presidente, ...) e — se opera sui canali PoliNetwork — con un'identità Telegram collegata, necessaria per accedere alla dashboard con l'attuale meccanismo di autenticazione.
- Un **Capo Admin** è un Admin con uno scope aggiuntivo (es. corso di studi) e visibilità limitata al proprio ambito.

### 3.3 Gerarchia proposta (minima, non inventata)

```
Owner / Presidente / Direttivo   — governance, accesso e scrittura completi
        │
   Capo Admin (per corso/ambito) — visibilità e azioni limitate al proprio ambito
        │
      Admin                       — operativo, oggi senza accesso alla dashboard
        │
      Socio                       — non ha accesso alla dashboard; è un record del censimento
```

Questa gerarchia **non corrisponde a nulla nel backend attuale** oltre al livello Owner/Presidente/Direttivo/HR. Costruirla richiede: un nuovo campo scope (es. corso di studi) sugli admin, un modo per marcare "Capo Admin" (nuovo ruolo o flag con scope), e l'estensione di `ADMIN_ROLES` per dare accesso in lettura scoped agli admin semplici e ai Capo Admin — oggi esclusi.

---

## 4. Matrice di priorità complessiva

Legenda stato: 🟢 Implementato · 🟡 Parziale · 🔴 Mancante

| # | Funzionalità | Origine | Stato | Priorità | Dipendenza principale |
|---|---|---|---|---|---|
| 1 | RBAC granulare per modulo/scope | Nuova (emersa dall'analisi) | 🔴 | **P0** | Nessuna, estende `authorization.ts` |
| 2 | Audit amministrativo unificato | Nuova | 🔴 | **P0** | Nuovo schema/endpoint backend |
| 3 | Censimento Soci (anagrafica) | Vecchio PRD §4 (implicito) | 🔴 | **P1** | Nuovo dominio dati backend |
| 4 | Dashboard "command center" (home con KPI) | Nuova, evoluzione overview attuale | 🟡 | **P1** | Aggregati dal Censimento |
| 5 | Governance / Direttivo | Nuova (backend pronto) | 🟡 (backend pronto, UI assente) | **P1** | Nessuna per MVP read-only |
| 6 | Dashboard Admin e Capo Admin | Vecchio PRD §3 | 🔴 | **P1** | Censimento + nuovo scope "corso" + estensione ruoli |
| 7 | Gestione Soci e Rinnovi | Vecchio PRD §4 | 🔴 | **P1** | Censimento + servizio email nel backend condiviso |
| 8 | FAQ (Web) | Nuova (backend pronto) | 🟡 (backend pronto, UI assente) | **P1** | Nessuna, basso sforzo |
| 9 | Aree Team interni | Vecchio PRD §2 | 🔴 | **P2** | Struttura team come dato |
| 10 | Onboarding nuovi Admin | Vecchio PRD §6 | 🔴 | **P2** | Riprogettazione di processo con HR, poi Censimento |
| 11 | Email di compleanno | Vecchio PRD §5 | 🔴 | **P2** | Censimento (data di nascita non esiste oggi) |
| 12 | Miglioramenti Telegram (storico grant, moderazione) | Aree esistenti | 🟡 | **P2** | Nuovi endpoint backend per lo storico |
| 13 | Miglioramenti Azure (licenze, access review) | Aree esistenti | 🟡 | **P2** | Estensione backend/Graph |
| 14 | Area Associazioni Partner (accesso, richieste, crediti) | Vecchio PRD §1 (era P0 lì) | 🔴 | **P2** (declassata, vedi §0) | Nuovo modello di autenticazione multi-tenant |
| 15 | Eventi associazioni / PoliTamTam | Vecchio PRD §1.4 | 🔴 | **P2** | Area Associazioni Partner o inserimento solo lato PoliNetwork |
| 16 | Area Aziende | Vecchio PRD §7 | 🔴 | **P3** | Da progettare, soggetti esterni |
| 17 | Area proprietari casa / Bacheca casa | Vecchio PRD §8-9 | 🔴 | **P3** | Da progettare, soggetti esterni |
| 18 | Newsletter | Vecchio PRD §10 | 🔴 | **P3** | Censimento + eventi |

---

## 5. Feature prioritarie — dominio interno PoliNetwork

### 5.1 Fondamenta (P0)

#### 5.1.1 Autorizzazione per capacità (RBAC granulare)

**Stato: mancante.** Oggi un ruolo apre o chiude intere aree; non esiste un permesso per singola azione né uno scoping ("solo il mio corso", "solo lettura su questo modulo").

Requisiti minimi:
- Permessi indipendenti per modulo: lettura/scrittura su soci, Telegram, Azure, contenuti, governance, audit.
- Composizione di ruoli: un utente può avere più capacità (es. Content editor + Telegram moderator).
- Azioni ad alto impatto (cancellazioni, assegnazione ruoli, rimozione da gruppi, export dati personali) devono mostrare il permesso richiesto e richiedere conferma esplicita.
- Deve restare retrocompatibile con `ADMIN_ROLES`/`WRITE_ADMIN_ROLES`: i ruoli Telegram esistenti diventano un caso particolare del nuovo modello, non vengono sostituiti da un giorno all'altro.

#### 5.1.2 Audit amministrativo unificato

**Stato: mancante** (esiste solo l'audit di moderazione Telegram, dominio diverso).

Ogni mutazione lanciata da `writeAdminMiddleware` dovrebbe produrre una voce di audit con: attore, ruolo al momento dell'azione, timestamp, oggetto modificato, valori prima/dopo, motivo (obbligatorio per azioni sensibili), esito. Necessario prima di esporre dati personali del Censimento a più ruoli.

#### 5.1.3 Home come centro operativo

**Stato: parziale** — oggi è un elenco statico di link (`overview-page.tsx:6-119`). Priorità P1 (dipende dagli aggregati del Censimento, quindi viene dopo le fondamenta P0), ma la si cita qui perché è il punto di ingresso di tutte le altre funzionalità: soci in scadenza, account non riconciliati, grant in scadenza, contenuti da pubblicare, attività recenti. Ogni indicatore deve poter essere cliccato per aprire la lista filtrata corrispondente.

#### 5.1.4 Ricerca globale

**Stato: mancante.** Una command palette che cerchi trasversalmente soci, utenti Telegram, gruppi, membri Azure, FAQ e contenuti, utile fin da subito e non dipendente dal Censimento (può iniziare cercando solo su Telegram/Azure/contenuti già esistenti).

---

### 5.2 Censimento Soci — l'anagrafica associativa (P1)

**Stato: mancante.** È il gap più importante identificato: oggi non esiste un'entità "persona" canonica. Telegram, Azure e Better Auth rappresentano la stessa persona con tre identità scollegate.

#### 5.2.1 Entità e campi MVP

| Blocco | Campi | Note |
|---|---|---|
| Identità | nome, cognome, email, telefono (opzionale) | |
| Identificativo | ID interno, numero associativo univoco | oggi vive solo in Azure; va deciso se resta lì o diventa proprietà di questa nuova entità (Decisione aperta) |
| Stato | prospect, richiesta, attivo, sospeso, scaduto, ex socio | |
| Iscrizione | data ingresso, periodo/anno associativo, data scadenza, stato rinnovo | |
| Profilo associativo | corso di studi, anno di corso, sede, competenze/interessi (opzionali) | necessario anche per §5.6 |
| Relazioni | ruolo organizzativo (§3.3), team, responsabile | |
| Integrazioni | Telegram ID/username, Azure user ID, ultimo sync | collega senza duplicare |
| Consensi | consenso, fonte, data, revoca | minimo indispensabile per email automatiche (§5.7, §5.8) |

Vincoli: numero associativo univoco; storicizzazione degli stati (non sovrascrittura); nessuna cancellazione bulk senza anteprima e conferma; ogni lettura/scrittura sensibile passa per l'audit di §5.1.2.

#### 5.2.2 Flusso MVP

```
Richiesta → verifica dati → deduplica → approvazione → numero socio
        → collegamento opzionale a Telegram/Azure → welcome → rinnovo → storico
```

#### 5.2.3 Permessi

- Creazione/modifica: ruoli con `members.write` (Direttivo/Owner/President inizialmente).
- Lettura: `members.read`, assegnabile anche a HR **in sola lettura** (coerente con il pattern già in uso per HR sul resto della dashboard).
- Un operatore deve poter creare un socio **senza** dover prima creare un account Azure: oggi non è possibile, perché il numero associativo esiste solo dentro Azure.

---

### 5.3 Governance e Direttivo (P1)

**Stato: parziale — il backend è pronto, manca la UI.** `tg.permissions.getDirettivo` restituisce già la composizione del Direttivo con `isPresident`. Un MVP a basso sforzo:

- pagina "Direttivo" in sola lettura con i membri correnti;
- in una seconda iterazione: incarico, data inizio/fine, storico nomine (richiede nuovo storage, non presente nel contratto attuale).

---

### 5.4 Dashboard Admin e Capo Admin (dal vecchio PRD §3, P1)

**Stato: mancante**, sia come dato che come UI e come permesso (§3.3, §1.3).

Requisiti (adattati dal vecchio PRD, subordinati al Censimento):

- Vista Capo Admin: elenco degli admin del proprio corso di studi con nome, cognome, anno di corso, data di ingresso, flag rappresentante, altre associazioni di appartenenza, telefono, username/contatto Telegram, link rapido WhatsApp/Telegram.
- Filtri: nome/cognome, anno, rappresentanza, altre associazioni.
- Sezione link ai gruppi Telegram di competenza del Capo Admin.
- Permessi: il Capo Admin deve vedere **solo** i dati e i gruppi del proprio ambito — richiede lo scoping descritto in §5.1.1, non disponibile con il modello attuale a ruoli globali.

**Precondizione bloccante**: senza il Censimento (corso di studi, data di ingresso, rappresentanza) e senza l'estensione dei permessi per dare accesso scoped a chi ha solo il ruolo `admin`, questa funzionalità non è costruibile nella forma descritta dal vecchio PRD.

---

### 5.5 Gestione Soci e Rinnovi (dal vecchio PRD §4, P1)

**Stato: mancante**, dipende interamente dal Censimento.

- Rinnovo automatico via email poco prima della scadenza: richiede un motore di invio email nel backend condiviso (non presente in questo repository) e la data di scadenza del Censimento.
- Vista Direttivo sullo stato dei soci: da verificare, pagamento effettuato, pagamento non effettuato.
- Azioni: "Segna come pagato" (aggiorna stato + email di conferma), "Invia reminder" (nuova email di promemoria).
- Storico minimo delle azioni (chi ha segnato pagato, quando è stato inviato un reminder) — si appoggia all'audit unificato di §5.1.2.
- Il vecchio PRD dispensa esplicitamente dalla necessità di gestire il pagamento *dentro* la dashboard nella prima versione: manteniamo questa impostazione.

---

### 5.6 Aree Team interni (dal vecchio PRD §2, P2)

**Stato: mancante come dato**, ma la navigazione attuale (`dashboardNavigation` in `src/components/dashboard-navigation.ts`) è già organizzata a categorie modulari (Telegram / Azure / Web), quindi si presta ad accogliere nuove categorie (es. "Team IT", "Team HR", ...) senza ristrutturazioni.

Per questa fase, l'obiettivo minimo è **struttura, ruoli e separazione degli accessi**, non le funzionalità specifiche di ciascun team (che il vecchio PRD stesso rimanda a una definizione successiva con i responsabili):

- ogni team come entità del Censimento (§5.2, blocco "Relazioni");
- pagina/area indipendente per team con permesso dedicato (si appoggia a §5.1.1);
- nessuna funzionalità specifica di team implementata in questa fase.

---

### 5.7 Onboarding nuovi Admin (dal vecchio PRD §6, P2)

**Stato: mancante.** Il vecchio PRD stesso richiede di ridisegnare il processo con HR e Team IT prima di digitalizzarlo: questo PRD conferma che **non esiste alcuna base dati di candidature oggi**, quindi non c'è nulla da migrare, solo da progettare da zero una volta chiarito il flusso (vedi Decisioni aperte §11).

Ambito minimo suggerito una volta definito il processo: candidatura → stato → colloquio → approvazione → creazione profilo (Censimento) → assegnazione corso/ruoli/team → passaggi di ingresso operativo.

---

### 5.8 Email di compleanno (dal vecchio PRD §5, P2)

**Stato: mancante.** Dipende dal Censimento (nessuna entità ha oggi una data di nascita) e da un motore email nel backend condiviso. Riguarda solo i soci e solo l'email, come indicato nel vecchio PRD.

---

### 5.9 FAQ pubbliche (P1, basso sforzo)

**Stato: backend pronto, UI assente.** `web.faqs.*` espone già categorie e CRUD bilingue completo (§1.5). È il rapporto valore/sforzo migliore di tutto il documento: aggiungere `Web → FAQs` con categorie, domanda/risposta IT/EN, ricerca, riordino drag&drop (pattern già usato in `Web Projects`), stato bozza/pubblicata.

---

### 5.10 Miglioramenti alle aree esistenti (P2)

- **Telegram grants**: storico dei grant terminati/interrotti (richiede un endpoint backend dedicato: oggi esiste solo `getOngoing`/`getScheduled`); reminder sulle scadenze imminenti.
- **Telegram groups**: creazione/import di gruppi dalla dashboard, indicatori di salute (gruppo senza owner, invito rotto), statistiche.
- **Azure**: gestione licenze dalla UI (richiede estensione del backend/Graph API, oggi non esposta); access review periodico sui gruppi.
- **Guide**: workflow bozza/pubblicazione, anteprima PDF, storico versioni invece di sola sostituzione.

---

## 6. Feature secondarie — aree per soggetti esterni

Per il criterio dichiarato in §0 e §2.1, queste aree sono **declassate in priorità** rispetto al vecchio PRD, pur restando le funzionalità di business più corpose descritte nel documento originale.

### 6.1 Area Associazioni Partner (dal vecchio PRD §1 — lì priorità massima)

**Stato: mancante interamente.** Riguarda un pubblico esterno (le associazioni partner) e presuppone un **modello di autenticazione multi-tenant** che oggi non esiste: l'unico meccanismo di accesso attuale presume un singolo tipo di utente (un collaboratore interno con ruolo Telegram). Includerebbe, secondo il vecchio PRD:

- accesso e gestione account per decine di associazioni (creazione/disattivazione, recupero credenziali, referenti multipli);
- richieste di pubblicazione nei gruppi WhatsApp/Telegram (**WhatsApp non è integrato in nessuna parte del sistema attuale**);
- gestione della pagina pubblica dell'associazione con flusso di richiesta/approvazione (oggi `Web Associations` è già CRUD **diretto** da parte di PoliNetwork, non un flusso di richiesta da parte dell'associazione — sarebbe un cambio di modello, non un'estensione);
- eventuale sistema a crediti (logica non definita nel vecchio PRD stesso);
- eventi delle associazioni / "PoliTamTam" (§6.2).

Questo PRD non ne nega il valore di business, ma lo colloca dopo le fondamenta interne (§5), perché richiede decisioni architetturali (autenticazione multi-tenant, eventuale integrazione WhatsApp) che è più sicuro prendere dopo aver stabilizzato RBAC, audit e Censimento.

### 6.2 Eventi delle associazioni — PoliTamTam (dal vecchio PRD §1.4)

**Stato: mancante.** Dipende dalla decisione su §6.1: se le associazioni partner inseriscono direttamente gli eventi, serve prima l'accesso esterno; se invece PoliNetwork inserisce gli eventi per conto delle associazioni (variante più semplice e coerente con il modello attuale, dove solo PoliNetwork scrive contenuti pubblici), può essere realizzato prima, come estensione del modulo `Web` esistente, sullo stesso pattern di `Web Projects`/`Web Associations`.

### 6.3 Area Aziende (dal vecchio PRD §7)

**Stato: mancante.** Da progettare in dettaglio prima dello sviluppo, come indicato anche nel vecchio PRD. Priorità bassa in questo documento.

### 6.4 Area proprietari di casa / Bacheca casa e coinquilini (dal vecchio PRD §8-9)

**Stato: mancante.** Riguarda esclusivamente soggetti esterni (proprietari, cercatori di stanza). Priorità più bassa dell'intero documento.

### 6.5 Newsletter (dal vecchio PRD §10)

**Stato: mancante.** Il vecchio PRD la marca già come non bloccante. Dipende da Censimento (segmentazione destinatari) ed eventualmente da §6.2 (eventi come fonte di contenuti).

---

## 7. Vincoli trasversali

- **Nessuna azione distruttiva su più righe** senza anteprima e conferma esplicita (vincolo permanente, `AGENTS.md`).
- `AGENT_MODE` resta esclusivo dell'ambiente di sviluppo locale; ogni modifica a codice di autenticazione/redirect va verificata anche con `AGENT_MODE=false`.
- **Minimizzazione dati**: ogni campo del Censimento deve avere uno scopo dichiarato; dati sensibili (es. codice fiscale) solo se realmente necessari per il tesseramento.
- **Audit prima di esporre dati personali** a più ruoli (§5.1.2 è precondizione di §5.2, §5.4, §5.5).
- **Query lato server e paginazione reale**: oggi tutte le liste caricano `getAll` e filtrano nel browser (`users-page.tsx`, `members-page.tsx`, ecc.). Accettabile ai volumi attuali; da rivedere non appena il Censimento supera qualche centinaio di record.
- **Lingua**: i contenuti pubblici (associazioni, progetti, FAQ) sono già bilingue IT/EN nel backend; l'interfaccia amministrativa è oggi interamente in inglese. Va deciso un indirizzo esplicito (Decisione aperta §11) prima di aggiungere nuove pagine con testo lungo (es. Censimento, Rinnovi).

---

## 8. Roadmap proposta

| Fase | Contenuto | Obiettivo |
|---|---|---|
| **0 — Fondamenta** | RBAC per capacità (§5.1.1), audit unificato (§5.1.2), ricerca globale (§5.1.4) | Base sicura e osservabile per esporre dati personali in fase 1 |
| **1 — Censimento e governance** | Censimento Soci MVP (§5.2), pagina Direttivo read-only (§5.3), FAQ (§5.9) | Registro soci utilizzabile, primo valore rapido a basso sforzo |
| **2 — Gerarchia e rinnovi** | Dashboard Admin/Capo Admin (§5.4), Gestione Soci e Rinnovi (§5.5), home come command center (§5.1.3) | Gestione del ciclo di vita di admin e soci |
| **3 — Team e onboarding** | Aree Team (§5.6), Onboarding nuovi Admin (§5.7, dopo riprogettazione con HR), email di compleanno (§5.8) | Copertura dei processi interni residui |
| **4 — Aree esistenti** | Miglioramenti Telegram/Azure (§5.10) | Colmare i gap sulle integrazioni già in produzione |
| **5 — Aree esterne** | Associazioni Partner (§6.1), PoliTamTam (§6.2) | Prima area rivolta a soggetti esterni, dopo le fondamenta interne |
| **6 — Espansione** | Aziende, Casa, Newsletter (§6.3-6.5) | Funzionalità secondarie, a valutazione |

---

## 9. Criteri di accettazione (MVP Censimento, come esempio di riferimento)

Ripresi e confermati perché indipendenti da qualunque decisione aperta:

- Un operatore può creare un socio senza dover prima creare un account Azure.
- La scheda del socio mostra chiaramente identità locale, Telegram e Azure e segnala i collegamenti mancanti.
- Nessuna scrittura in un'importazione massiva prima della conferma di un'anteprima.
- Un ruolo HR read-only può consultare solo ciò che il suo permesso consente e non vede pulsanti di scrittura.
- Ogni cambio di stato, numero associativo o identità esterna è rintracciabile nell'audit.
- Nessuna cancellazione massiva senza conferma esplicita e riepilogo delle righe coinvolte.

---

## 10. Cosa NON fa parte di questo PRD

- Non ridefinisce lo statuto, gli organi sociali o le regole di voto dell'associazione: assume che la struttura Owner/Presidente/Direttivo esistente sui ruoli Telegram sia quella corretta finché non diversamente indicato.
- Non decide se e come integrare pagamenti (Stripe, bonifico, altro): il vecchio PRD stesso rimanda il pagamento fuori dalla dashboard nella prima versione, e questo documento mantiene la stessa impostazione.
- Non propone una contabilità completa (fatture, bilanci): per pagamenti e documenti sensibili resta preferibile integrare servizi specializzati.

---

## 11. Decisioni aperte

Raggruppate per paragrafo di riferimento. Nessuna ipotesi organizzativa è stata inventata: dove il vecchio PRD o il codice non permettevano di dedurre una risposta, la domanda è riportata qui invece di essere decisa autonomamente.

**§3 — Ruoli e gerarchie**
1. Il ruolo "Capo Admin" va modellato come nuovo ruolo Telegram/backend, o come attributo applicativo (scope) sopra il ruolo `admin` esistente, gestito solo lato dashboard?
2. Chi assegna e revoca il ruolo di Capo Admin, e con quale periodicità (es. legato all'anno accademico)?
3. Il ruolo `admin` "semplice" deve ottenere accesso alla dashboard (anche solo in lettura sul proprio ambito), oppure resta escluso come oggi?

**§5.2 — Censimento Soci**
4. Il numero associativo resta una proprietà di Azure, o diventa proprietà del nuovo registro soci (con Azure che lo referenzia)?
5. L'iscrizione è annuale, semestrale o senza scadenza?
6. Quali dati sono realmente necessari per il tesseramento (es. il codice fiscale è richiesto dal processo associativo reale, o va escluso)?
7. Un ruolo HR read-only può leggere tutti i campi del socio, o alcuni campi (es. dati di contatto personali) devono essere mascherati anche per HR?

**§5.4 — Dashboard Admin e Capo Admin**
8. Come si definisce "corso di studi" nel sistema (elenco chiuso dei corsi del Politecnico, testo libero, altro)?
9. Un admin può appartenere a più corsi/ambiti, o a uno solo?

**§5.5 — Gestione Soci e Rinnovi**
10. Il pagamento della quota resta interamente manuale (bonifico/altro) fuori dashboard, o si prevede in futuro un'integrazione (es. Stripe)?
11. Chi ha il permesso di "segnare come pagato": solo Direttivo, o anche un ruolo Finance dedicato non ancora esistente?

**§5.7 — Onboarding nuovi Admin**
12. Il processo di candidatura/colloquio è già stato ridisegnato con HR e Team IT (come richiesto dal vecchio PRD stesso), o va progettato da zero in questo ciclo?

**§6.1 — Area Associazioni Partner**
13. Un account per associazione, o più referenti per la stessa associazione fin dal MVP?
14. Le richieste di pubblicazione riguardano solo Telegram (unico canale oggi integrato) o resta necessaria l'integrazione WhatsApp menzionata nel vecchio PRD?
15. Il sistema a crediti per le pubblicazioni resta previsto, e con quale logica di ricarica/consumo?
16. La gestione della pagina pubblica dell'associazione deve diventare un flusso di richiesta/approvazione (come indicato dal vecchio PRD), sostituendo l'attuale CRUD diretto di PoliNetwork su `Web Associations`?

**§6.2 — Eventi / PoliTamTam**
17. Gli eventi sono inseriti direttamente dalle associazioni partner (richiede §6.1) o da PoliNetwork per conto loro (realizzabile prima, sul modello di `Web Projects`)?
18. Gli eventi vengono pubblicati immediatamente o richiedono approvazione PoliNetwork?

**§7 — Lingua dell'interfaccia**
19. L'interfaccia amministrativa deve diventare bilingue con preferenza per utente, o restare in italiano per il team associativo mantenendo IT/EN solo sui contenuti pubblici?
