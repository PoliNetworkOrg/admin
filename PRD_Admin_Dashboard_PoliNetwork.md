# PRD — Admin Dashboard PoliNetwork

**Documento di prodotto per il Team IT**
**Versione:** 1.1
**Data:** 29 agosto 2026 (revisione con correzioni e decisioni del Team IT rispetto alla v1.0 del 20 agosto 2026)
**Stato:** Bozza per revisione
**Branch/commit di riferimento per l'analisi:** `report/new-feature-roadmap`, con `pnpm install --frozen-lockfile` eseguito per ispezionare il contratto `@polinetwork/backend@0.17.1`.

## 0. Scopo e metodo di questo documento

Questo documento è un **nuovo PRD**, che sostituisce il precedente `PRD_Admin_Dashboard_Associazione.md` (v0.2, rimosso da questa repository perché superato). Il vecchio documento restava un riferimento sui bisogni di business espressi dall'associazione, ma **non era usato come fonte di verità tecnica**: ogni funzionalità qui descritta è stata verificata direttamente su:

- il codice del frontend/BFF in `src/` (route, feature, server functions, middleware di autorizzazione);
- il contratto tipizzato del backend reale, `node_modules/@polinetwork/backend/dist/index.d.ts` (unica sorgente di verità su cosa il backend espone oggi via tRPC: router `tg`, `azure`, `web`, `auth`, `test`);
- i test (`tests/server-security.test.mjs`) e la configurazione (`AGENTS.md`, `package.json`, `README.md`).

Dove il vecchio PRD presuppone dati, ruoli o flussi che non esistono nel codice attuale, questo documento lo segnala esplicitamente come **mancante**, propone l'ipotesi minima necessaria per renderlo implementabile, e rimanda le decisioni non deducibili alla sezione **11. Decisioni aperte**.

**Criterio di priorità dichiarato dal Team IT e applicato qui:** le funzionalità interne di PoliNetwork (anagrafica soci, censimento admin/team, ruoli e gerarchie, governance, team) hanno priorità sulle aree pensate per soggetti esterni (associazioni partner, aziende, alloggi), **anche dove il vecchio PRD indicava l'ordine opposto**. Questo è il motivo principale per cui la struttura delle priorità in questo documento differisce da quella del documento originale.

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

1. **Priorità interna prima che esterna**: anagrafica soci, censimento admin/team, ruoli, governance e team vengono prima di associazioni partner, aziende, alloggi — vedi §0.
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

**Raccomandazione**: introdurre progressivamente il primo piano come dato del futuro Censimento Admin/Team e dell'Anagrafica Soci (§5.2), e permessi applicativi granulari (§5.1.1) sopra — senza necessariamente toccare il piano Telegram, che resta la fonte di verità per la moderazione dei gruppi.

### 3.2 Socio, Admin e membro di team — categorie indipendenti, non annidate

**Correzione rispetto a una lettura gerarchica**: il vecchio PRD usa "socio" (chi versa la quota associativa) e "admin" (chi si occupa operativamente dell'associazione) in un modo che suggerisce una relazione di inclusione ("admin, spesso ma non necessariamente anche socio"). Questa lettura va corretta: si tratta di **tre categorie indipendenti**, non di una gerarchia annidata:

- **Socio**: chi risulta iscritto e in regola con la quota associativa (Anagrafica Soci, §5.2).
- **Admin**: chi ha un ruolo operativo/organizzativo su PoliNetwork (oggi il ruolo Telegram `admin` e superiori).
- **Membro di un team interno** (IT, Design & Social, International, HR, Events & Partnerships, ...): chi fa parte di un team (§5.6).

Un admin può essere socio o no; un socio può essere admin o no; un membro di un team può essere admin, socio, entrambi o nessuno dei due. **Le tre categorie possono intersecarsi in qualunque combinazione** e nessuna implica automaticamente le altre due.

**Il Socio resta comunque la categoria più rilevante per l'associazione**: è chi la costituisce formalmente dal punto di vista associativo. Admin e membro di team sono categorie organizzative/operative e non sostituiscono né presuppongono lo status di socio.

Nel codice attuale questa distinzione non esiste: `AzureMember.isMember` è l'unico flag di appartenenza, e riguarda solo chi ha (o dovrebbe avere) un account Microsoft 365. Un admin senza account Azure non è "socio" in nessuna parte del sistema oggi.

**Ipotesi minima adottata in questo PRD** (da confermare, vedi Decisioni aperte §11):

- Un **Socio** è un record dell'Anagrafica Soci (§5.2), indipendente da Telegram e da Azure, e indipendente dall'essere o meno admin/membro di team.
- Un **Admin** è una persona con un ruolo organizzativo (Admin, Capo Admin, Direttivo, Presidente, ...) tracciato dal Censimento Admin/Team (§5.2) e — se opera sui canali PoliNetwork — con un'identità Telegram collegata, necessaria per accedere alla dashboard con l'attuale meccanismo di autenticazione. Non deve necessariamente essere anche Socio.
- Un **Capo Admin** è un Admin con uno scope aggiuntivo (es. corso di studi) e visibilità limitata al proprio ambito.

### 3.3 Gerarchia proposta (minima, non inventata)

La gerarchia seguente riguarda **solo l'asse ruolo organizzativo/operativo** (Owner → Capo Admin → Admin). Lo status di **Socio** e l'appartenenza a un **team interno** sono assi indipendenti (§3.2): non sono un livello sotto "Admin", ma condizioni che possono coesistere con qualunque punto della gerarchia sottostante, o con nessuno.

```
Owner / Presidente / Direttivo   — governance, accesso e scrittura completi
        │
   Capo Admin (per corso/ambito) — visibilità e azioni limitate al proprio ambito
        │
      Admin                       — operativo, oggi senza accesso alla dashboard
```

Questa gerarchia **non corrisponde a nulla nel backend attuale** oltre al livello Owner/Presidente/Direttivo/HR. Costruirla richiede: un nuovo campo scope (es. corso di studi) sugli admin, un modo per marcare "Capo Admin" (nuovo ruolo o flag con scope — **ancora da decidere**, §11), e l'estensione di `ADMIN_ROLES` per dare accesso in lettura scoped agli admin semplici e ai Capo Admin. **Deciso**: l'admin semplice deve ottenere accesso alla dashboard, con permessi determinati dal proprio scope (§11) — oggi ne è escluso, quindi resta lavoro da fare su `authorization.ts`.

---

## 4. Matrice di priorità complessiva

Legenda stato: 🟢 Implementato · 🟡 Parziale · 🔴 Mancante · ⚪ Obsoleto (non verrà realizzato)

| # | Funzionalità | Origine | Stato | Priorità | Dipendenza principale |
|---|---|---|---|---|---|
| 1 | RBAC granulare per modulo/scope | Nuova (emersa dall'analisi) | 🔴 | **P0** | Nessuna, estende `authorization.ts` |
| 2 | Audit amministrativo unificato | Nuova | 🔴 | **P0** | Nuovo schema/endpoint backend |
| 3 | Identity Provider PoliNetwork | Nuova (richiesta esplicita Team IT) | 🔴 | **P0** | Nuovo servizio; precondizione di §5.1.5, §5.7, §6.1 |
| 4 | Gestione consensi e firma privacy policy in dashboard | Nuova (richiesta esplicita Team IT) | 🔴 | **P0** | Identity Provider (#3) |
| 5 | Anagrafica Soci (attivi paganti + storico) | Vecchio PRD §4 (implicito), corretta | 🔴 | **P1** | Nuovo dominio dati backend |
| 6 | Censimento Admin/Team (rinnovo interesse) | Nuova, corretta da bozza "censimento soci" | 🔴 | **P1** | Nuovo dominio dati backend + Identity Provider (#3) per il flusso self-service (§5.7) |
| 7 | Dashboard "command center" (home con KPI) | Nuova, evoluzione overview attuale | 🟡 | **P1** | Aggregati da Anagrafica Soci/Censimento |
| 8 | Governance / Direttivo (pagina dedicata) | Nuova (backend pronto) | ⚪ **Obsoleto** | — | Assorbito dal Censimento Admin/Team (#6), vedi §5.3 |
| 9 | Dashboard Admin e Capo Admin | Vecchio PRD §3 | 🔴 | **P1** | Censimento Admin/Team + nuovo scope "corso" + estensione ruoli |
| 10 | Gestione Soci e Rinnovi (quota, ricevute) | Vecchio PRD §4, corretta | 🔴 | **P1** | Anagrafica Soci + upload/approvazione ricevute in dashboard |
| 11 | FAQ (Web) | Nuova (backend pronto) | 🟡 (backend pronto, UI assente) | **P1** | Nessuna, basso sforzo |
| 12 | Aree Team interni | Vecchio PRD §2 | 🔴 | **P2** | Struttura team come dato |
| 13 | Onboarding e Censimento Admin (flusso self-service) | Vecchio PRD §6, molto ampliata | 🔴 | **P2** | Identity Provider (#3), Censimento Admin/Team (#6) |
| 14 | Email di compleanno | Vecchio PRD §5 | 🔴 | **P2** | Anagrafica Soci (data di nascita non esiste oggi) |
| 15 | Miglioramenti Telegram (storico grant, moderazione) | Aree esistenti | 🟡 | **P2** | Nuovi endpoint backend per lo storico |
| 16 | Miglioramenti Azure (licenze, access review) | Aree esistenti | 🟡 | **P2** | Estensione backend/Graph |
| 17 | Area Associazioni Partner (accesso multi-referente, richieste, crediti) | Vecchio PRD §1 (era P0 lì), corretta | 🔴 | **P2** (declassata, vedi §0) | Identity Provider (#3) per l'accesso esterno multi-tenant |
| 18 | Eventi associazioni / PoliTamTam | Vecchio PRD §1.4, corretta | 🔴 | **P2** | Area Associazioni Partner (#17), flusso di approvazione |
| 19 | Area Aziende | Vecchio PRD §7 | 🔴 | **P3** | Da progettare, soggetti esterni |
| 20 | Area proprietari casa / Bacheca casa | Vecchio PRD §8-9 | 🔴 | **P3** | Da progettare, soggetti esterni |
| 21 | Newsletter | Vecchio PRD §10 | 🔴 | **P3** | Anagrafica Soci + eventi |

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

#### 5.1.5 Gestione dei consensi e firma della privacy policy in dashboard

**Stato: mancante.** Oggi le autorizzazioni privacy vengono raccolte tramite vari form esterni inviati caso per caso. Questo espone a un rischio concreto: le domande dei form possono cambiare o diventare obsolete nel tempo, e la perdita o l'abbandono di un form significa perdere anche la possibilità di dimostrare/recuperare il consenso raccolto con quella versione.

Requisiti minimi:
- La firma della privacy policy (e di eventuali altre informative) avviene **dentro il flusso della dashboard** (iscrizione socio, §5.2.2; onboarding/censimento admin, §5.7), non più solo tramite form esterni scollegati.
- Ogni consenso registrato è legato a una **versione specifica del testo firmato**, con data e revoca tracciabili nel tempo (campo "Consensi" di §5.2.1/§5.2.3): un cambiamento futuro del testo non invalida né sovrascrive lo storico dei consensi già raccolti.
- L'evento di firma passa per l'audit unificato (§5.1.2).
- Richiede l'Identity Provider (§5.1.6) per autenticare con certezza chi sta firmando prima di associare il consenso alla persona corretta.

#### 5.1.6 Identity Provider PoliNetwork

**Stato: mancante — nuovo requisito del Team IT.** Il Team IT ha richiesto esplicitamente di realizzare un **identity/authentication provider** proprio di PoliNetwork, distinto dal semplice login attuale (email OTP/passkey su Better Auth, §1.2), da usare come punto di ingresso unico per i flussi self-service rivolti a persone interne (ed eventualmente esterne):

- autenticazione preventiva obbligatoria prima di qualunque flusso di censimento/onboarding (§5.7), firma documenti (§5.1.5) o consultazione delle proprie statistiche/riferimenti (es. Capo Admin di riferimento);
- base per assegnare permessi differenziati "in base a cosa la persona fa/è" all'interno di PoliNetwork (ogni persona ha comunque un livello minimo di accesso alle proprie informazioni);
- precondizione per un futuro accesso esterno multi-tenant (associazioni partner, §6.1), oggi non supportato dal modello di autenticazione attuale.

Il rapporto tra questo nuovo Identity Provider e l'attuale Better Auth (sostituzione, estensione, o livello applicativo sopra le identità Telegram/Azure esistenti) resta una decisione architetturale da prendere a parte (vedi Decisioni aperte, §11): questo PRD ne registra il requisito, non la soluzione tecnica.

---

### 5.2 Anagrafica Soci e Censimento Admin/Team (P1)

**Stato: mancante.** È il gap più importante identificato: oggi non esiste un'entità "persona" canonica. Telegram, Azure e Better Auth rappresentano la stessa persona con tre identità scollegate.

**Correzione rispetto a una bozza precedente che parlava genericamente di "censimento soci"**: si tratta in realtà di due cose distinte, coerenti con l'indipendenza delle categorie di §3.2:

- **Anagrafica Soci**: un registro dei **soci attivi e paganti**, con **storico** dei soci passati. Per un socio l'azione ricorrente è il **rinnovo della quota associativa** (§5.5), non una rilevazione periodica di interesse.
- **Censimento Admin/Team**: una rilevazione rivolta ad **admin e membri dei team**, il cui scopo è **rinnovare l'interesse/la disponibilità** a continuare il proprio ruolo organizzativo — non una quota. Si integra con l'Onboarding (§5.7).

Una persona può comparire in entrambi, in uno solo, o in nessuno dei due (§3.2).

#### 5.2.1 Anagrafica Soci — campi MVP

| Blocco | Campi | Note |
|---|---|---|
| Identità | nome, cognome, email, telefono (opzionale) | |
| Identificativo | ID interno, numero associativo univoco | **Deciso**: il numero associativo diventa proprietà di questo nuovo registro (database PoliNetwork); Azure lo referenzia se presente, non è più l'unica fonte (§11) |
| Stato | attivo pagante, sospeso, scaduto, ex socio | |
| Iscrizione | data ingresso, anno associativo (**deciso: iscrizione annuale**, §11), data scadenza, stato rinnovo | |
| Profilo associativo | corso di studi, anno di corso, sede, competenze/interessi (opzionali) | necessario anche per §5.6 |
| Consensi | consenso privacy policy, fonte, data, versione firmata, revoca | firma diretta in dashboard, vedi §5.1.5 |

Alcuni campi sono obbligatori e altri opzionali (**deciso in linea di principio**; l'elenco puntuale, incluso se serva il codice fiscale, resta da definire — §11). Lettura: HR può leggere l'Anagrafica Soci; il dettaglio dei permessi granulari campo per campo resta da definire con calma (§11).

Vincoli: numero associativo univoco; storicizzazione degli stati (non sovrascrittura: i soci scaduti/ex soci restano nello storico, non vengono rimossi); nessuna cancellazione bulk senza anteprima e conferma; ogni lettura/scrittura sensibile passa per l'audit di §5.1.2.

#### 5.2.2 Flusso MVP — Anagrafica Soci

```
Richiesta/iscrizione → verifica dati → deduplica → firma privacy policy (§5.1.5) → approvazione → numero socio
        → collegamento opzionale a Telegram/Azure → rinnovo annuale della quota (§5.5) → storico
```

#### 5.2.3 Censimento Admin/Team — campi e flusso MVP

Rivolto a chi ha un ruolo organizzativo (Admin, Capo Admin, Direttivo, membro di team), indipendentemente dall'essere anche Socio (§3.2).

| Blocco | Campi | Note |
|---|---|---|
| Identità | nome, cognome, email, telefono | |
| Relazioni | ruolo organizzativo (§3.3), team (§5.6), Capo Admin/responsabile di riferimento | |
| Integrazioni | Telegram ID/username, Azure user ID, ultimo sync | collega senza duplicare |
| Rinnovo interesse | data ultima conferma, prossima scadenza conferma, esito | sostituisce il concetto di "quota" per questa popolazione |
| Consensi | consenso privacy policy, fonte, data, versione firmata | vedi §5.1.5 |

Flusso: rilevazione periodica (periodicità da definire, es. legata all'anno accademico — §11) → conferma interesse/disponibilità tramite il flusso automatizzato di Onboarding/Censimento in dashboard (§5.7) → aggiornamento stato → storico.

#### 5.2.4 Permessi

- Creazione/modifica (Anagrafica Soci e Censimento Admin/Team): ruoli con `members.write` (Direttivo/Owner/President inizialmente).
- Lettura: `members.read`, assegnabile anche a HR **in sola lettura** (coerente con il pattern già in uso per HR sul resto della dashboard); quali campi restino mascherati anche per HR va deciso con calma (§11).
- Un operatore deve poter creare un socio o un record del Censimento Admin/Team **senza** dover prima creare un account Azure: oggi non è possibile, perché il numero associativo esiste solo dentro Azure.

---

### 5.3 Governance e Direttivo — ⚪ Obsoleto

**Stato: dichiarato obsoleto dal Team IT.** Questa sezione (pagina "Direttivo" dedicata, in sola lettura, con eventuale storico incarichi) **non verrà realizzata come area a sé stante**. I dati utili che avrebbe dovuto mostrare — composizione del Direttivo, ruolo organizzativo, incarico — sono coperti dal Censimento Admin/Team (§5.2.3) e dalla gerarchia ruoli (§3.3), che restano la fonte di riferimento per queste informazioni.

`tg.permissions.getDirettivo` (composizione del Direttivo con `isPresident`) resta comunque una capacità di backend già pronta e riusabile come sorgente dati per il Censimento Admin/Team, non serve più però una pagina dedicata separata.

---

### 5.4 Dashboard Admin e Capo Admin (dal vecchio PRD §3, P1)

**Stato: mancante**, sia come dato che come UI e come permesso (§3.3, §1.3).

Requisiti (adattati dal vecchio PRD, subordinati al Censimento):

- Vista Capo Admin: elenco degli admin del proprio corso di studi con nome, cognome, anno di corso, data di ingresso, flag rappresentante, altre associazioni di appartenenza, telefono, username/contatto Telegram, link rapido WhatsApp/Telegram.
- Filtri: nome/cognome, anno, rappresentanza, altre associazioni.
- Sezione link ai gruppi Telegram di competenza del Capo Admin.
- Permessi: il Capo Admin deve vedere **solo** i dati e i gruppi del proprio ambito — richiede lo scoping descritto in §5.1.1, non disponibile con il modello attuale a ruoli globali.

**Deciso**: una persona admin appartiene a **un solo corso di studi** come dato anagrafico personale, ma può essere **admin/Capo Admin con scope su gruppi di corsi diversi** contemporaneamente (§11) — il "corso di appartenenza" personale e lo "scope di responsabilità" da admin sono due campi distinti, non lo stesso valore. Il modello dati deve quindi separare il corso personale del Censimento Admin/Team (§5.2.3) dallo/dagli scope assegnati come Capo Admin.

**Precondizione bloccante**: senza il Censimento Admin/Team (corso di studi, data di ingresso, rappresentanza) e senza l'estensione dei permessi per dare accesso scoped a chi ha solo il ruolo `admin`, questa funzionalità non è costruibile nella forma descritta dal vecchio PRD.

---

### 5.5 Gestione Soci e Rinnovi (dal vecchio PRD §4, P1)

**Stato: mancante**, dipende interamente dall'Anagrafica Soci (§5.2).

**Correzione rispetto alla bozza precedente**: il pagamento della quota resta un **bonifico bancario fuori dashboard** (non si integra un gateway di pagamento in questa fase, §10), ma il **flusso di verifica del pagamento diventa in-dashboard**:

- Il socio può **caricare la ricevuta del bonifico in dashboard**; il caricamento avvia una richiesta di approvazione.
- Il Direttivo/ruolo autorizzato approva la ricevuta caricata, oppure segna il rinnovo come effettuato **manualmente** se la ricevuta non viene caricata (es. verifica diretta in banca).
- **Ricevuta automatizzata**: quando un rinnovo viene approvato, la dashboard genera e invia automaticamente la ricevuta al socio (nuovo requisito rispetto alla bozza precedente).
- Per i rinnovi **del Direttivo verso l'associazione stessa** (quota versata dai membri del Direttivo), la ricevuta viene generata/automatizzata allo stesso modo dalla dashboard; quando è richiesta una firma, il flusso notifica il **Presidente**, che deve firmarla.
- Rinnovo automatico via email poco prima della scadenza: richiede un motore di invio email nel backend condiviso (non presente in questo repository) e la data di scadenza dell'Anagrafica Soci.
- Vista Direttivo sullo stato dei soci: da verificare, ricevuta caricata in attesa di approvazione, pagamento effettuato, pagamento non effettuato.
- Azioni: "Approva ricevuta"/"Segna come pagato" (aggiorna stato + genera ricevuta + email di conferma), "Invia reminder" (nuova email di promemoria).
- Storico minimo delle azioni (chi ha approvato/segnato pagato, quando è stato inviato un reminder, ricevute generate) — si appoggia all'audit unificato di §5.1.2.
- Resta da decidere se il permesso di "segnare come pagato"/approvare ricevute sia riservato al solo Direttivo o esteso a un futuro ruolo Finance dedicato (§11).

---

### 5.6 Aree Team interni (dal vecchio PRD §2, P2)

**Stato: mancante come dato**, ma la navigazione attuale (`dashboardNavigation` in `src/components/dashboard-navigation.ts`) è già organizzata a categorie modulari (Telegram / Azure / Web), quindi si presta ad accogliere nuove categorie (es. "Team IT", "Team HR", ...) senza ristrutturazioni.

Per questa fase, l'obiettivo minimo è **struttura, ruoli e separazione degli accessi**, non le funzionalità specifiche di ciascun team (che il vecchio PRD stesso rimanda a una definizione successiva con i responsabili):

- ogni team come entità del Censimento Admin/Team (§5.2.3, blocco "Relazioni");
- pagina/area indipendente per team con permesso dedicato (si appoggia a §5.1.1);
- nessuna funzionalità specifica di team implementata in questa fase.

---

### 5.7 Onboarding e Censimento Admin — flusso self-service in dashboard (dal vecchio PRD §6, P2)

**Stato: mancante.** Il vecchio PRD stesso richiede di ridisegnare il processo con HR e Team IT prima di digitalizzarlo; il dettaglio del processo (candidatura, colloquio, criteri) **resta da definire bene** (§11). Questo PRD ne fissa però una direzione precisa, indicata esplicitamente dal Team IT:

**Cambio di canale**: sia il censimento di nuovi candidati admin, sia il censimento periodico di admin già attivi, non passano più per Telegram e scambio di messaggi manuale, ma per un **flusso automatizzato della dashboard**, attivabile tramite un link o una mail inviata alla persona.

Requisiti minimi:
- **Autenticazione preventiva obbligatoria** sull'Identity Provider PoliNetwork (§5.1.6) prima di poter proseguire nel flusso — serve sia a identificare con certezza la persona sia a determinare il tipo di candidatura/censimento applicabile al suo caso.
- Una volta autenticato, l'utente accede a un'area personale dove può: firmare i documenti richiesti (privacy policy e altri, §5.1.5), consultare le proprie statistiche, vedere il proprio **Capo Admin di riferimento** (dato dal Censimento Admin/Team, §5.2.3).
- **Permessi differenziati per ruolo**: ogni membro di PoliNetwork ha un livello di accesso diverso in base a cosa fa/è nell'associazione, ma **tutti hanno accesso a qualcosa** nella propria area — nessun ruolo resta completamente escluso dal proprio spazio personale.
- **Richieste che risalgono la gerarchia**: ad esempio, un admin può presentare dalla propria area la richiesta di diventare admin di un determinato gruppo, e la richiesta arriva al proprio Capo Admin di riferimento per l'approvazione (pattern di richiesta/approvazione coerente con quello descritto per le associazioni partner, §6.1).

Ambito minimo suggerito una volta definito il dettaglio del processo: link/mail di attivazione → autenticazione (Identity Provider) → candidatura o conferma censimento periodico → firma documenti → colloquio/approvazione (per i nuovi) → creazione/aggiornamento profilo (Censimento Admin/Team, §5.2.3) → assegnazione corso/ruoli/team → passaggi di ingresso operativo.

---

### 5.8 Email di compleanno (dal vecchio PRD §5, P2)

**Stato: mancante.** Dipende dall'Anagrafica Soci (nessuna entità ha oggi una data di nascita) e da un motore email nel backend condiviso. Riguarda solo i soci e solo l'email, come indicato nel vecchio PRD.

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

**Stato: mancante interamente.** Riguarda un pubblico esterno (le associazioni partner) e presuppone un **modello di autenticazione multi-tenant** che oggi non esiste: l'unico meccanismo di accesso attuale presume un singolo tipo di utente (un collaboratore interno con ruolo Telegram). Il dettaglio di business di quest'area è già definito nei documenti dell'associazione; qui si registra solo quanto rilevante per la dashboard, includendo, secondo il vecchio PRD e le precisazioni del Team IT:

- accesso e gestione account per decine di associazioni. **Deciso**: si può creare l'account a **uno o più referenti** della stessa associazione fin dal MVP, e i referenti possono **nominare un successore trasferendo l'ownership** del proprio account (es. passaggio di consegne interno all'associazione partner);
- richieste di pubblicazione nei gruppi Telegram: **deciso**, le associazioni presentano la richiesta dalla propria pagina/area e PoliNetwork approva. Le richieste possono riguardare **più gruppi contemporaneamente**; la dashboard mostra già l'elenco completo dei gruppi tra cui scegliere, quindi non serve un nuovo modulo di selezione gruppi. Resta da chiarire se serva anche l'integrazione WhatsApp menzionata nel vecchio PRD (§11), oggi non integrata in nessuna parte del sistema;
- gestione della pagina pubblica dell'associazione con flusso di richiesta/approvazione: **deciso**, sostituisce l'attuale CRUD diretto di PoliNetwork su `Web Associations` — è un cambio di modello, non una semplice estensione;
- eventuale sistema a crediti: logica ancora non definita, resta aperta (§11);
- eventi delle associazioni / "PoliTamTam" (§6.2).

Questo PRD non ne nega il valore di business, ma lo colloca dopo le fondamenta interne (§5), perché richiede l'Identity Provider PoliNetwork (§5.1.6) per l'accesso esterno multi-tenant, che è più sicuro introdurre dopo aver stabilizzato RBAC, audit e Anagrafica Soci/Censimento.

### 6.2 Eventi delle associazioni — PoliTamTam (dal vecchio PRD §1.4)

**Stato: mancante.** **Deciso**: gli eventi vengono inseriti dalle associazioni partner **dalla propria pagina/area** (dipende quindi dall'accesso esterno di §6.1); PoliNetwork può inoltre aggiungere propri eventi, o eventualmente eventi per conto di altre associazioni. In nessun caso la pubblicazione è diretta: **ogni evento richiede approvazione** prima di comparire pubblicamente, sullo stesso pattern di richiesta/approvazione di §6.1.

### 6.3 Area Aziende (dal vecchio PRD §7)

**Stato: mancante.** Da progettare in dettaglio prima dello sviluppo, come indicato anche nel vecchio PRD. Priorità bassa in questo documento.

### 6.4 Area proprietari di casa / Bacheca casa e coinquilini (dal vecchio PRD §8-9)

**Stato: mancante.** Riguarda esclusivamente soggetti esterni (proprietari, cercatori di stanza). Priorità più bassa dell'intero documento.

### 6.5 Newsletter (dal vecchio PRD §10)

**Stato: mancante.** Il vecchio PRD la marca già come non bloccante. Dipende dall'Anagrafica Soci (segmentazione destinatari) ed eventualmente da §6.2 (eventi come fonte di contenuti).

---

## 7. Vincoli trasversali

- **Nessuna azione distruttiva su più righe** senza anteprima e conferma esplicita (vincolo permanente, `AGENTS.md`).
- `AGENT_MODE` resta esclusivo dell'ambiente di sviluppo locale; ogni modifica a codice di autenticazione/redirect va verificata anche con `AGENT_MODE=false`.
- **Minimizzazione dati**: ogni campo del Censimento deve avere uno scopo dichiarato; dati sensibili (es. codice fiscale) solo se realmente necessari per il tesseramento.
- **Audit prima di esporre dati personali** a più ruoli (§5.1.2 è precondizione di §5.2, §5.4, §5.5).
- **Query lato server e paginazione reale**: oggi tutte le liste caricano `getAll` e filtrano nel browser (`users-page.tsx`, `members-page.tsx`, ecc.). Accettabile ai volumi attuali; da rivedere non appena il Censimento supera qualche centinaio di record.
- **Lingua**: i contenuti pubblici (associazioni, progetti, FAQ) sono già bilingue IT/EN nel backend; l'interfaccia amministrativa è oggi interamente in inglese. **Deciso**: l'interfaccia amministrativa diventerà **bilingue IT/EN con preferenza impostabile per singolo utente** (§11) — le nuove pagine con testo lungo (Anagrafica Soci, Censimento Admin/Team, Rinnovi) vanno progettate da subito con questo vincolo.

---

## 8. Roadmap proposta

| Fase | Contenuto | Obiettivo |
|---|---|---|
| **0 — Fondamenta** | RBAC per capacità (§5.1.1), audit unificato (§5.1.2), ricerca globale (§5.1.4), Identity Provider PoliNetwork (§5.1.6), consensi/firma privacy in dashboard (§5.1.5) | Base sicura, osservabile e autenticata per esporre dati personali e far firmare documenti in fase 1 |
| **1 — Anagrafica e censimento** | Anagrafica Soci MVP (§5.2.1-2), Censimento Admin/Team MVP (§5.2.3), FAQ (§5.9) — nota: la governance/Direttivo dedicata (§5.3) è **obsoleta** e non rientra più in questa fase | Registro soci e censimento admin/team utilizzabili, primo valore rapido a basso sforzo |
| **2 — Gerarchia e rinnovi** | Dashboard Admin/Capo Admin (§5.4), Gestione Soci e Rinnovi con ricevute in dashboard (§5.5), home come command center (§5.1.3) | Gestione del ciclo di vita di admin e soci |
| **3 — Team e onboarding** | Aree Team (§5.6), Onboarding e Censimento Admin self-service (§5.7, dopo riprogettazione con HR), email di compleanno (§5.8) | Copertura dei processi interni residui |
| **4 — Aree esistenti** | Miglioramenti Telegram/Azure (§5.10) | Colmare i gap sulle integrazioni già in produzione |
| **5 — Aree esterne** | Associazioni Partner multi-referente (§6.1), PoliTamTam (§6.2) | Prima area rivolta a soggetti esterni, dopo le fondamenta interne e l'Identity Provider |
| **6 — Espansione** | Aziende, Casa, Newsletter (§6.3-6.5) | Funzionalità secondarie, a valutazione |

---

## 9. Criteri di accettazione (MVP Anagrafica Soci e Censimento Admin/Team, come esempio di riferimento)

Ripresi e confermati perché indipendenti da qualunque decisione aperta:

- Un operatore può creare un socio senza dover prima creare un account Azure.
- La scheda del socio/admin mostra chiaramente identità locale, Telegram e Azure e segnala i collegamenti mancanti.
- Nessuna scrittura in un'importazione massiva prima della conferma di un'anteprima.
- Un ruolo HR read-only può consultare solo ciò che il suo permesso consente e non vede pulsanti di scrittura.
- Ogni cambio di stato, numero associativo o identità esterna è rintracciabile nell'audit.
- Nessuna cancellazione massiva senza conferma esplicita e riepilogo delle righe coinvolte.
- Un socio può caricare la ricevuta di un bonifico in dashboard e vederne lo stato di approvazione; se non la carica, il rinnovo può comunque essere segnato manualmente da chi ha il permesso.
- Un consenso privacy firmato in dashboard resta associato alla versione del testo firmata al momento della firma, anche se il testo cambia in seguito.
- Nessun flusso di censimento/onboarding self-service procede senza autenticazione riuscita sull'Identity Provider PoliNetwork.

---

## 10. Cosa NON fa parte di questo PRD

- Non ridefinisce lo statuto, gli organi sociali o le regole di voto dell'associazione: assume che la struttura Owner/Presidente/Direttivo esistente sui ruoli Telegram sia quella corretta finché non diversamente indicato.
- Non decide se e come integrare un gateway di pagamento (Stripe, altro): il pagamento resta un bonifico bancario **eseguito fuori dashboard**. È invece in scope la **verifica** del pagamento in dashboard (upload ricevuta, approvazione, ricevuta automatizzata — §5.5): non è più un rinvio integrale come nella bozza precedente, ma resta comunque escluso qualunque flusso di incasso/gateway dentro l'applicazione.
- Non propone una contabilità completa (fatture, bilanci): per pagamenti e documenti sensibili resta preferibile integrare servizi specializzati.

---

## 11. Decisioni aperte

Raggruppate per paragrafo di riferimento. Nessuna ipotesi organizzativa è stata inventata: dove il vecchio PRD o il codice non permettevano di dedurre una risposta, la domanda è riportata qui invece di essere decisa autonomamente.

**§3 — Ruoli e gerarchie**
1. Il ruolo "Capo Admin" va modellato come nuovo ruolo Telegram/backend, o come attributo applicativo (scope) sopra il ruolo `admin` esistente, gestito solo lato dashboard? — **Ancora da decidere**, risposta esplicita del Team IT: "non lo so, da decidere".
2. Chi assegna e revoca il ruolo di Capo Admin, e con quale periodicità (es. legato all'anno accademico)? — **Deciso in parte**: il **Direttivo** assegna e revoca il ruolo. La periodicità resta da definire.
3. Il ruolo `admin` "semplice" deve ottenere accesso alla dashboard (anche solo in lettura sul proprio ambito), oppure resta escluso come oggi? — **Deciso**: sì, l'admin ottiene accesso con **permessi determinati** dal proprio scope (vedi §3.3, §5.1.1).

**§5.2 — Anagrafica Soci e Censimento Admin/Team**
4. Il numero associativo resta una proprietà di Azure, o diventa proprietà del nuovo registro soci (con Azure che lo referenzia)? — **Deciso**: i dati diventano proprietà del **nostro database** (Anagrafica Soci); Azure lo referenzia se presente.
5. L'iscrizione è annuale, semestrale o senza scadenza? — **Deciso**: **annuale**.
6. Quali dati sono realmente necessari per il tesseramento (es. il codice fiscale è richiesto dal processo associativo reale, o va escluso)? — **Deciso in parte**: alcuni dati saranno obbligatori, altri opzionali. L'elenco puntuale campo per campo (incluso se serva il codice fiscale) resta da definire.
7. Un ruolo HR read-only può leggere tutti i campi del socio, o alcuni campi (es. dati di contatto personali) devono essere mascherati anche per HR? — **Deciso in parte**: HR può leggere l'Anagrafica Soci; i permessi granulari campo per campo vanno pensati con calma, restano da definire nel dettaglio.

**§5.4 — Dashboard Admin e Capo Admin**
8. Come si definisce "corso di studi" nel sistema (elenco chiuso dei corsi del Politecnico, testo libero, altro)? — **Ancora aperta**, non affrontata.
9. Un admin può appartenere a più corsi/ambiti, o a uno solo? — **Deciso**: una persona admin appartiene a **un solo corso** come dato personale, ma può **essere admin/Capo Admin su gruppi di corsi diversi** come scope di responsabilità (i due concetti sono distinti, vedi §5.4).

**§5.5 — Gestione Soci e Rinnovi**
10. Il pagamento della quota resta interamente manuale (bonifico/altro) fuori dashboard, o si prevede in futuro un'integrazione (es. Stripe)? — **Deciso**: il pagamento resta **bonifico**, eseguito fuori dashboard. In dashboard il socio può però **caricare la ricevuta** per farla approvare, oppure il rinnovo viene segnato **manualmente** se la ricevuta non è caricata. Per i rinnovi del Direttivo verso l'associazione, la ricevuta viene generata/automatizzata dalla dashboard, con firma del Presidente quando richiesta.
11. Chi ha il permesso di "segnare come pagato": solo Direttivo, o anche un ruolo Finance dedicato non ancora esistente? — **Ancora aperta**: il Direttivo approva le ricevute caricate, ma se questo compito debba restare esclusivo del Direttivo o essere esteso a un futuro ruolo Finance non è stato specificato.

**§5.7 — Onboarding e Censimento Admin**
12. Il processo di candidatura/colloquio è già stato ridisegnato con HR e Team IT (come richiesto dal vecchio PRD stesso), o va progettato da zero in questo ciclo? — **Ancora da definire bene** (risposta esplicita del Team IT), ma la direzione del canale è ormai fissata: flusso automatizzato in dashboard con autenticazione preventiva, non più Telegram (§5.7). Restano da definire i dettagli operativi del processo (criteri, colloquio, tempistiche).

**§5.1 — Identity Provider PoliNetwork** *(nuovo gruppo)*
20. Il nuovo Identity Provider PoliNetwork (§5.1.6) sostituisce integralmente l'attuale autenticazione Better Auth, o si affianca ad essa come livello applicativo sopra le identità Telegram/Azure/Better Auth esistenti?
21. Il consenso privacy raccolto in dashboard (§5.1.5) sostituisce integralmente i form esterni oggi in uso, o convive con essi durante una fase di transizione?
22. Con quale periodicità si svolge il Censimento Admin/Team (§5.2.3) — es. una volta per anno accademico, o legato a un altro evento?

**§6.1 — Area Associazioni Partner**
13. Un account per associazione, o più referenti per la stessa associazione fin dal MVP? — **Deciso**: si possono creare **uno o più account/referenti** per associazione fin dal MVP, con possibilità di **nominare un successore e trasferire l'ownership** dell'account.
14. Le richieste di pubblicazione riguardano solo Telegram (unico canale oggi integrato) o resta necessaria l'integrazione WhatsApp menzionata nel vecchio PRD? — **Ancora aperta**: da verificare nei documenti di business esterni citati dal Team IT.
15. Il sistema a crediti per le pubblicazioni resta previsto, e con quale logica di ricarica/consumo? — **Ancora aperta**, logica non definita.
16. La gestione della pagina pubblica dell'associazione deve diventare un flusso di richiesta/approvazione (come indicato dal vecchio PRD), sostituendo l'attuale CRUD diretto di PoliNetwork su `Web Associations`? — **Deciso**: sì. Le associazioni richiedono dalla propria pagina/area, PoliNetwork approva; le richieste possono riguardare più gruppi contemporaneamente e la dashboard mostra già l'elenco completo dei gruppi disponibili.

**§6.2 — Eventi / PoliTamTam**
17. Gli eventi sono inseriti direttamente dalle associazioni partner (richiede §6.1) o da PoliNetwork per conto loro (realizzabile prima, sul modello di `Web Projects`)? — **Deciso**: le associazioni inseriscono gli eventi dalla propria pagina; PoliNetwork può aggiungere anche eventi propri o, eventualmente, per conto di altre associazioni.
18. Gli eventi vengono pubblicati immediatamente o richiedono approvazione PoliNetwork? — **Deciso**: richiedono sempre approvazione; nessuna pubblicazione avviene direttamente.

**§7 — Lingua dell'interfaccia**
19. L'interfaccia amministrativa deve diventare bilingue con preferenza per utente, o restare in italiano per il team associativo mantenendo IT/EN solo sui contenuti pubblici? — **Deciso**: bilingue, **con preferenza impostabile per singolo utente**.
