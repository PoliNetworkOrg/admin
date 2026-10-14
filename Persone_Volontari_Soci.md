# Persone, Volontari e Libro Soci — specifica

**Documenti collegati:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) §1.2, §3, §5, §7, §8 · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md) · [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md)
**Versione:** 0.1
**Data:** 14 ottobre 2026
**Stato:** Proposta da revisionare con Direttivo, HR e Team IT. Nulla di quanto descritto qui è implementato, salvo dove indicato come «oggi».
**Repository coinvolte:** `admin` (dashboard), `backend` (dati e API), `auth` (IdP)

Questo documento specifica la sezione **Persone** della dashboard: Libro Soci, censimento di admin e membri dei team, viste per ruolo, permessi e collegamento con gli account IdP. Raffina i §3, §5, §7 e §8 del PRD; dove i due documenti divergono, vale questo.

---

## 0. In breve

1. **La scheda della persona vive nel backend ed esiste anche senza account.** Le circa 150 persone del censimento vengono importate e gestite anche se non accederanno mai all'IdP.
2. **L'account IdP si collega alla scheda dopo, con una verifica**: Telegram verificato, invito personale o conferma di un operatore. Non si crea mai una seconda scheda e lo storico resta sulla stessa persona.
3. **Socio, Admin e Membro di team sono tre ruoli indipendenti della stessa persona.** Ognuno ha i propri dati: le informazioni chieste a un admin non sono quelle chieste a un membro del team o a un socio.
4. **L'IdP decide le capacità globali** (es. «vedere tutti gli admin»). **Il backend decide le visibilità limitate** a partire dagli incarichi registrati nella scheda: chi è Team Lead di IT vede IT, chi è Capo Admin di un ambito vede gli admin di quell'ambito.
5. **Il Libro Soci diventa un registro PoliNetwork nel backend.** Microsoft 365 resta l'account tecnico del socio, collegato al registro.

---

## 1. Contesto

### 1.1 Fonti di dati oggi

| Fonte | Cosa contiene | Limite |
|---|---|---|
| Microsoft 365 / Entra (pagina «Members» della dashboard) | Account `@polinetwork.org` dei soci, gruppo Soci, numero socio nel campo `employeeId`. La PR admin #95 / backend #70 / auth #53 aggiunge il cambio del numero socio (`azure:members:write`). | È una directory di account, non un libro soci: niente storico, stati, annualità o quote. |
| Modulo Volontari (Microsoft Forms, anno 26/27) | Conferma o abbandono, tipologia (Group Admin / Membro Team), anagrafica, corso, sede, rappresentanza, altre associazioni, gruppi, disponibilità a Capo Admin, consensi privacy e foto/video. | Dati in un foglio esterno, una riga per risposta. Non è collegato alle persone né ai gruppi. |
| Backend `tg_users`, `tg_group_admins` | Utenti Telegram visti dal bot e admin registrati per ciascun gruppo. | Identificati dal Telegram ID, non da una persona. |
| IdP `auth` | Chi si è registrato, account collegati (Google, Entra, Telegram, email Polimi), ruoli e permessi. | Contiene solo chi si registra. Il backend riceve dallo snapshot solo chi possiede almeno un permesso della propria proiezione (RFC v3 §5.2). |

### 1.2 Il problema

L'IdP mostra chi si è registrato, ma il censimento riguarda persone che in gran parte non si registreranno. Se l'IdP fosse l'anagrafica, queste persone mancherebbero; se le si aggiungesse a mano come «utenti», chi si registra dopo risulterebbe una persona diversa. Serve quindi un'anagrafica propria a cui collegare l'account, quando esiste.

---

## 2. Principi

### 2.1 Persona e account sono distinti

- **Persona** (backend): chi è, come contattarla, quali ruoli ha in PoliNetwork, con lo storico. Esiste dal momento dell'import o dell'inserimento.
- **Account IdP** (auth): come la persona si autentica e quali identità esterne possiede. È facoltativo.
- Una persona ha **al massimo un account IdP collegato**, e un account è collegato **al massimo a una persona** (vincolo univoco su entrambi i lati).

### 2.2 Fonte di verità per ciascun dato

| Dato | Fonte di verità | Note |
|---|---|---|
| Anagrafica, contatti, corso, sede | Scheda persona (backend) | Aggiornata dal censimento o dall'operatore. |
| Stato di socio, numero socio, date di ammissione e uscita | Libro Soci (backend) | Entra riceve il numero socio come copia (`employeeId`). |
| Incarichi (admin, team, Team Lead, Capo Admin) | Tabelle organizzative (backend) | Assegnati da chi ha il permesso, sempre in audit. |
| Gruppi Telegram amministrati | `tg_group_admins` (backend, dal bot) | Ricondotti alla persona tramite Telegram ID. Quelli scritti nel modulo sono una dichiarazione. |
| Identità verificate (Telegram ID, email) | IdP | Usate per collegare l'account. |
| Permessi globali | IdP (RBAC) | Nessun permesso deriva dall'essere censiti. |

### 2.3 Dichiarato e verificato

Alcune domande del modulo duplicano dati di cui esiste una fonte certa. La risposta viene conservata come dichiarazione e confrontata con la fonte; non la sostituisce.

- «Sei associato a PoliNetwork?» → confronto con il Libro Soci. Le discrepanze finiscono in una lista da verificare.
- «Elenca i gruppi in cui sei admin» → confronto con `tg_group_admins`.
- «Tag Telegram» → lo username può cambiare, quindi serve solo a suggerire il Telegram ID (§6.3).

---

## 3. Glossario

| Termine | Significato |
|---|---|
| **Persona** | Scheda nel backend con ID interno stabile (`P…`). |
| **Account** | Utente IdP (`sub`), collegabile a una persona. |
| **Socio** | Persona presente nel Libro Soci con un numero socio. |
| **Admin** | Volontario che amministra gruppi PoliNetwork (tipologia «Group Admin» del modulo). |
| **Capo Admin** | Admin referente per un ambito (corso o insieme di gruppi), nominato dal Direttivo. |
| **Team** | Team interno: IT, HR, Design & Social, International, Events & Partnerships. L'elenco è configurabile. |
| **Membro di team** | Persona con un'appartenenza attiva a un team. |
| **Team Lead** | Membro di team con ruolo di responsabile del proprio team. |
| **Campagna di censimento** | Rilevazione per anno accademico (es. 2026/27), con versione del modulo e dell'informativa. |
| **Risposta** | Ciò che una persona ha risposto in una campagna: conferma o abbandono, dati dichiarati, consensi. |

---

## 4. Modello dati (backend)

Le nuove tabelle seguono la convenzione `createTable` con nuovi prefissi. I nomi sono indicativi. I campi di contatto vanno cifrati a riposo come già avviene per i nomi in `tg_users`. Ogni tabella ha `timeColumns` e, per le scritture da dashboard, l'autore IdP (`*_by_sub`) come nelle tabelle web attuali.

### 4.1 Persone

**`people_persons`**

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid PK | ID interno stabile, mostrato come `P…` |
| `first_name`, `last_name` | text | |
| `personal_email` | text, cifrato | Email personale; diversa dall'eventuale `@polinetwork.org` |
| `phone` | text, cifrato | Formato E.164 |
| `telegram_id` | bigint, univoco se presente | Valorizzato solo se verificato (§5) o confermato da un operatore |
| `telegram_username` | text | Solo visualizzazione |
| `study_course` | text oppure FK a un elenco corsi | Decisione aperta (PRD §19 punto 8) |
| `study_year` | enum | `1T`, `2T`, `3T+`, `1M`, `2M+`, `graduated` |
| `campus` | enum | `leonardo`, `bovisa`, `cremona`, `piacenza`, `mantova`, `lecco`, `external` |
| `other_associations` | text | Altre associazioni o liste |
| `student_representative` | bool + `representative_bodies` text | CCS, Senato, CdA, … |
| `profile_as_of` | FK campagna | Campagna da cui provengono corso, anno e sede |
| `idp_sub` | text, univoco se presente | Account collegato |
| `linked_at`, `link_method`, `linked_by_sub` | | `link_method`: `telegram`, `invite`, `operator` |
| `archived_at` | timestamp | Archiviazione, non cancellazione |

**`people_link_invites`**: `id`, `person_id`, `email`, `token_hash`, `expires_at`, `used_at`, `used_by_sub`, `created_by_sub`. Token monouso; il nuovo invito invalida il precedente.

**`people_consents`**: `person_id`, `document` (`privacy-volontari`, `foto-video`, `privacy-soci`, …), `document_version`, `granted` bool, `source` (`msforms_import`, `dashboard`, `operator`), `recorded_at`, `revoked_at`. Righe solo aggiunte: una revoca è una nuova riga, non una modifica.

### 4.2 Organizzazione

**`org_admin_profiles`**: una riga per persona che è o è stata admin.

| Campo | Note |
|---|---|
| `person_id` | PK e FK |
| `status` | `active`, `paused`, `ended` |
| `volunteering_since` | Data indicativa dichiarata («Da quanto collabori») |
| `ended_on`, `end_reason` | `degree`, `personal`, `other` + testo |
| `available_as_capo_admin` | bool, dichiarato |
| `requested_groups` | text: gruppi in cui vorrebbe entrare (dichiarato) |
| `hr_notes` | Note interne, visibili solo con `people:notes:read` |

I gruppi effettivamente amministrati **non** si salvano qui: si leggono da `tg_group_admins` con `people_persons.telegram_id = tg_group_admins.user_id`.

**`org_capo_admin_scopes`**: `person_id`, `group_label_id` (FK `common_group_labels`) oppure `group_id` (FK `tg_groups`), `starts_on`, `ends_on`, `assigned_by_sub`. Un Capo Admin può avere più ambiti, distinti dal proprio corso personale (PRD §1.3).

**`org_teams`**: `id`, `slug` (`it`, `hr`, `design-social`, `international`, `events-partnerships`), `name_it`, `name_en`, `active`.

**`org_team_memberships`**

| Campo | Note |
|---|---|
| `person_id`, `team_id` | Una persona può stare in più team |
| `role` | `member`, `lead` |
| `started_on`, `ended_on`, `end_reason` | Storico: chi esce non viene cancellato |
| `team_fields` | jsonb validato dallo schema del team (§4.4) |

### 4.3 Censimento

**`census_campaigns`**: `id`, `academic_year` (`2026/27`), `title`, `status` (`draft`, `open`, `closed`), `opens_at`, `closes_at`, `form_version`, `privacy_document_version`.

**`census_responses`**

| Campo | Note |
|---|---|
| `campaign_id`, `person_id` | Una risposta valida per persona e campagna; le correzioni sostituiscono la precedente e restano in audit |
| `volunteer_type` | `admin`, `team` |
| `team_id` | Per `team`; il modulo attuale non lo chiede (§6.4) |
| `continues` | bool |
| `end_reason` | Se `continues = false` |
| `answers` | jsonb: copia integrale delle risposte, utile come prova di cosa è stato dichiarato |
| `source` | `msforms_import`, `dashboard`, `operator` |
| `external_id` | ID della risposta Forms, per reimport idempotenti |
| `submitted_at`, `submitted_by_sub` | |

### 4.4 Campi specifici per team

Ogni team può avere campi propri, definiti nel backend come schema zod versionato per `slug` e validati su `org_team_memberships.team_fields`. Gli esempi vanno confermati con ciascun Team Lead:

| Team | Campi di esempio |
|---|---|
| IT | Username GitHub, aree (frontend, backend, bot, infrastruttura), repository seguite |
| Design & Social | Strumenti, portfolio, canali gestiti |
| HR | Ambiti (colloqui, onboarding, censimento) |
| International | Lingue, paese di provenienza |
| Events & Partnerships | Eventi seguiti, contatti partner di riferimento |

All'inizio lo schema è nel codice: modificarlo richiede una PR, ma garantisce validazione e tipi. Un editor di campi gestibile dai Lead si valuterà quando i campi saranno stabili.

### 4.5 Libro Soci

**`members_register`**

| Campo | Note |
|---|---|
| `person_id` | FK, univoco |
| `member_number` | Intero univoco: il numero socio |
| `status` | `active`, `suspended`, `expired`, `former` |
| `admitted_on`, `ended_on`, `end_reason` | |
| `azure_user_id` | Account Microsoft 365, se esiste |

**`members_years`**: `member_id`, `association_year`, `fee_status` (`due`, `receipt_uploaded`, `paid`, `unpaid`), `paid_on`, `receipt_ref`, `approved_by_sub`. Serve ai rinnovi del PRD §6.

Lo stato non si sovrascrive: ogni cambio è in audit e le annualità restano. Il numero socio si cambia nel registro, poi si sincronizza su Entra (`employeeId`). La procedura `azure.members.setAssocNumber` della PR backend #70 diventa la parte «sincronizza su Entra» di questo flusso.

### 4.6 Audit

Ogni mutazione delle tabelle sopra e ogni export scrivono una voce con attore (`sub`), azione, oggetto, valori prima e dopo, motivo (obbligatorio per collegamenti, scollegamenti, nomine e archiviazioni) e data. È la base dell'audit unificato del PRD §2.2: queste tabelle non vanno esposte a più ruoli prima che esista.

---

## 5. Account e collegamento

### 5.1 Stati della scheda

| Stato | Significato |
|---|---|
| **Non collegato** | La persona esiste solo nel backend. Condizione normale per chi non accede. |
| **Invito inviato** | Esiste un invito valido non ancora usato. |
| **Collegato** | `idp_sub` valorizzato. |
| **Da verificare** | Un tentativo di collegamento ha trovato un conflitto, ad esempio Telegram ID già su un'altra scheda o account già collegato. |

### 5.2 Metodi di collegamento

1. **Telegram verificato (automatico).** La persona entra nell'IdP e collega Telegram con l'OIDC ufficiale. Al primo accesso alla propria area, il backend chiede all'IdP il Telegram ID verificato del `sub`. Se coincide con il `telegram_id` di **una sola** scheda non collegata, propone il collegamento; la persona conferma.
2. **Invito personale.** Dalla scheda, un operatore invia un link monouso all'email personale raccolta. La persona entra nell'IdP con qualsiasi metodo, conferma «Sono io» e la scheda si collega al suo `sub`. Scadenza proposta: 14 giorni.
3. **Operatore.** Chi ha `people:links:manage` collega a mano un account a una scheda, con motivo obbligatorio. Serve per i conflitti e per chi non ha Telegram verificato né email valida.

**Regole:**

- Nome ed email uguali producono un **suggerimento**, mai un collegamento automatico.
- Lo username Telegram non basta: conta solo il Telegram ID verificato.
- Una scheda già collegata a un altro account va scollegata da un operatore prima di collegarne uno nuovo.
- Lo scollegamento non cancella nulla: la persona torna «Non collegato».
- Registrarsi all'IdP **non** crea una scheda, non rende socio e non assegna permessi. Chi entra senza scheda vede un messaggio con le istruzioni e può chiedere l'inserimento (§7.8).

### 5.3 Cosa manca nell'IdP

Oggi lo snapshot verso il backend include solo i soggetti con almeno un permesso della proiezione `backend` (RFC v3 §5.2). Per un volontario senza permessi il backend conosce il `sub` dal token, ma non il suo Telegram ID verificato. Serve uno di questi interventi in `auth`:

- **(Raccomandato) Endpoint interno di lookup**: `GET /api/internal/subjects/{sub}`, accessibile solo al client `backend` con scope `idp:subjects:read`. Restituisce `telegramId`, email verificate e nome visualizzato di **un** soggetto. Il backend lo chiama solo durante il collegamento.
- **Alternativa**: includere nella proiezione `backend` anche i soggetti con Telegram collegato e nessun permesso. È più semplice, ma espone al backend l'intera lista dei registrati.

Non si usano i claim inoltrati dalla dashboard: il backend deve ottenere il dato verificato dall'IdP.

---

## 6. Import del censimento esistente

### 6.1 Flusso

1. HR esporta le risposte di Forms (xlsx/csv) e le carica in **Persone → Censimenti → Importa**, scegliendo la campagna (es. 2026/27).
2. Il backend analizza il file e mostra un'**anteprima**: nuove persone, persone già esistenti con dati da aggiornare, duplicati interni al file, righe non valide e discrepanze (§2.3).
3. HR risolve i duplicati scegliendo «stessa persona» oppure «persone diverse».
4. Con conferma esplicita, il backend crea o aggiorna le schede, le risposte, i profili admin e le appartenenze ai team, e registra i consensi con `source = msforms_import` e la versione dell'informativa della campagna.
5. Reimportare lo stesso file non duplica nulla: le risposte sono identificate da `external_id`.

Nessuna riga viene eliminata. Le risposte «NO» chiudono il profilo admin o l'appartenenza con il motivo indicato, senza cancellare la persona.

### 6.2 Corrispondenza tra domande e dati

| Domanda del modulo (IT / EN) | Destinazione |
|---|---|
| 2/3 Vuoi continuare | `census_responses.continues` |
| 4, 23, 31, 39 Tipologia | `census_responses.volunteer_type`; crea o aggiorna `org_admin_profiles` oppure `org_team_memberships` |
| Nome, Cognome, Telefono, Email personale | `people_persons` |
| Tag Telegram | `telegram_username` e suggerimento del Telegram ID (§6.3) |
| Corso, Anno, Sede | `people_persons`, con `profile_as_of` = campagna |
| Altre associazioni, Rappresentante, Dove | `people_persons` |
| Da quanto collabori | `org_admin_profiles.volunteering_since` oppure `org_team_memberships.started_on` |
| Sei associato? | Solo in `answers`, confrontato con il Libro Soci |
| Altri gruppi desiderati | `org_admin_profiles.requested_groups` |
| Disponibile come Capo Admin | `org_admin_profiles.available_as_capo_admin` |
| Gruppi in cui sei admin (ramo NO) | Solo in `answers`, confrontato con `tg_group_admins` |
| Motivo dell'uscita (ramo NO) | `end_reason` |
| Consenso privacy, Consenso foto/video | `people_consents` |
| Spazio libero | Solo in `answers`, visibile con `census:responses:read` |

### 6.3 Telegram

Per ogni username importato, il backend cerca in `tg_users` un utente con quello username. Se lo trova, lo **propone** come Telegram ID; HR lo conferma singolarmente o in blocco dall'anteprima. Senza conferma, `telegram_id` resta vuoto. Il Telegram ID confermato abilita il collegamento automatico (§5.2) e il calcolo dei gruppi amministrati.

### 6.4 Modifiche suggerite al modulo per le prossime campagne

- Chi sceglie «Membro Team» non indica **quale team**: aggiungere la domanda, con selezione multipla.
- Rendere coerenti gli obblighi tra le versioni: il Tag Telegram è obbligatorio solo nel ramo NO in inglese, e «Altri gruppi» solo nel ramo SÌ in inglese.
- Chiedere il **Telegram ID** è inutile: lo fornisce il collegamento all'IdP.
- Dalla seconda campagna in dashboard (§7.7), le domande sui dati già noti diventano una conferma dei dati precompilati.

---

## 7. Sezione «Persone» della dashboard

### 7.1 Navigazione

```
Persone
├── Panoramica           tutte le persone, con indicatori Socio / Admin / Team / Account
├── Libro Soci           registro soci, stati, annualità
├── Admin                tutti gli admin
├── Team                 tutti i team e tutti i membri
│   └── <team>           pagina del singolo team (IT, HR, …)
├── Censimenti           campagne, risposte, import, solleciti
└── Collegamenti         schede da verificare e inviti in corso

Capo Admin               admin e gruppi del mio ambito (solo Capo Admin)

La mia area              la mia scheda, i miei team, il censimento, consensi, account
```

Ogni voce compare solo a chi ha il permesso o l'incarico corrispondente (§8, §9). La pagina «Members» di Microsoft 365 resta in **Microsoft 365** come strumento tecnico degli account; dal Libro Soci si apre l'account collegato.

### 7.2 Panoramica (vista totale)

Per Direttivo e HR. Una riga per persona, con le colonne comuni: nome, cognome, indicatori **Socio** (n°), **Admin** (attivo/ex), **Team** (elenco), **Capo Admin**, **Account** (collegato/non collegato), ultima risposta al censimento. Filtri su ciascun indicatore, corso, sede e stato. La scheda di dettaglio ha schede separate (Anagrafica, Socio, Admin, Team, Censimenti, Consensi, Account, Storico), ciascuna visibile secondo i permessi.

### 7.3 Libro Soci

Colonne: n° socio, nome, cognome, stato, data di ammissione, quota dell'anno corrente, email PoliNetwork, account collegato. Azioni (con `members:write`): nuovo socio, cambio stato, cambio numero (poi sincronizzato su Entra), registrazione dell'uscita. Export con `members:export`, in audit.

Il primo popolamento importa da Entra gli utenti del gruppo Soci con il loro `employeeId`, li associa a una scheda persona esistente o ne crea una nuova, e segnala gli utenti senza numero e i numeri duplicati.

### 7.4 Admin

Colonne: nome, cognome, corso, anno, sede, attivo da, gruppi amministrati (da `tg_group_admins`), gruppi richiesti, rappresentante, altre associazioni, disponibile come Capo Admin, Capo Admin di riferimento, socio sì/no, stato del censimento, account collegato. Filtri come nel PRD §5, più «senza gruppi», «dichiarati socio ma non nel Libro Soci» e «disponibili come Capo Admin».

### 7.5 Team

- **Tutti i team**: un riquadro per team (Lead, numero di membri, risposte al censimento mancanti) e una tabella unica di tutti i membri con colonna «Team».
- **Pagina del team** (`/dashboard/persone/team/<slug>`): membri attivi ed ex, ruolo, attivo da, campi specifici del team (§4.4), stato del censimento, consenso foto/video.

### 7.6 Capo Admin

Per chi ha un ambito attivo in `org_capo_admin_scopes`:

- admin che amministrano almeno un gruppo del proprio ambito, con i campi del PRD §5: nome, cognome, anno, attivo da, rappresentante, altre associazioni, telefono, Telegram con link rapido;
- gruppi dell'ambito, segnalando quelli senza admin;
- richieste di ingresso in gruppi dell'ambito (dal campo «gruppi desiderati» e, in futuro, dalle richieste del PRD §8).

### 7.7 Censimenti

- Elenco delle campagne e loro stato.
- Per ciascuna campagna: persone attese (admin e membri attivi alla data di apertura), risposte arrivate, «continua», «lascia», «nessuna risposta».
- Azioni: importa da Forms, invia solleciti a chi non ha risposto (email e, se collegato, Telegram), chiudi la campagna.
- **Fase successiva**: il modulo compilato direttamente in dashboard da «La mia area», con dati precompilati, informativa versionata e consensi registrati alla firma (PRD §2.5). A quel punto Forms va dismesso.

### 7.8 La mia area

Per ogni account collegato a una scheda:

- la propria scheda, con richiesta di correzione dei dati;
- i propri ruoli: socio (numero e stato), admin (gruppi), team;
- la risposta alla campagna aperta;
- i propri consensi, con possibilità di revoca;
- il proprio Capo Admin e il proprio Team Lead;
- per chi è membro di team, la rubrica del proprio team (§8).

Chi è registrato ma non ha una scheda vede «Non risulti tra i volontari o i soci» e può inviare una richiesta, che arriva in **Persone → Collegamenti**.

---

## 8. Viste per ruolo

| Chi | Cosa vede | Cosa può fare |
|---|---|---|
| **Direttivo / Presidente** | Tutte le viste, tutti i campi | Tutto; unici a nominare Team Lead e Capo Admin e a scrivere il Libro Soci |
| **HR** | Panoramica, Admin, Team, Censimenti, Collegamenti; Libro Soci in sola lettura | Gestire schede e censimenti, importare, sollecitare, collegare account |
| **Capo Admin** | Vista Capo Admin del proprio ambito | Vedere contatti e stato degli admin dell'ambito; in futuro approvare richieste di ingresso |
| **Team Lead** | Pagina del proprio team con tutti i campi, contatti inclusi | Aggiungere al team persone esistenti o nuove, modificare i campi del team, chiudere un'appartenenza (con motivo) |
| **Membro di team** | Rubrica del proprio team: nome, ruolo, Telegram, email PoliNetwork | Nessuna modifica altrui |
| **Admin** | La mia area | Compilare il censimento, gestire i propri consensi |
| **Socio non volontario** | La mia area, sezione socio | In futuro: rinnovo e ricevute (PRD §6) |
| **Team Design & Social** | Oltre al resto, il consenso foto/video di chi compare nei contenuti | Nessuna |
| **Volontario non registrato** | Nulla | Riceve inviti e solleciti; resta gestito da HR |

Un ruolo non esclude l'altro: chi è Team Lead di IT e Capo Admin vede entrambe le viste, ciascuna limitata al proprio ambito.

### 8.1 Visibilità dei campi

| Campo | Direttivo | HR | Capo Admin (ambito) | Team Lead (team) | Membro (team) | Sé stesso |
|---|---|---|---|---|---|---|
| Nome, cognome, Telegram | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Email personale, telefono | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Corso, anno, sede | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Rappresentanza, altre associazioni | ✓ | ✓ | ✓ | — | — | ✓ |
| Campi del team | ✓ | ✓ | — | ✓ | sola lettura dei campi pubblici del team | ✓ |
| Stato socio | ✓ | ✓ | — | — | — | ✓ |
| Note HR | ✓ | ✓ | — | — | — | — |
| Risposte integrali del censimento | ✓ | ✓ | — | stato risposta | — | ✓ |
| Consensi | ✓ | ✓ | — | foto/video | — | ✓ |

Il PRD §19 punto 6 resta aperto: se HR non deve vedere i contatti dei soci, si toglie `people:contacts:read` dal ruolo HR senza cambiare il modello.

---

## 9. Permessi

### 9.1 Nuovi permessi IdP (globali)

Chiavi esatte, da registrare in `auth` con una migrazione come `0016`/`0020`, aggiungendo il prefisso `people:` (e gli altri) alla proiezione `backend`. Nessuna implicazione automatica salvo dove indicato.

| Permesso | Consente | Ruolo suggerito |
|---|---|---|
| `people:read` | Panoramica, Admin, Team (tutti), schede: campi comuni | Direttivo, HR |
| `people:contacts:read` | Email personale e telefono nelle viste globali | Direttivo, HR |
| `people:notes:read` | Note HR e risposte integrali | Direttivo, HR |
| `people:write` | Creare, modificare e archiviare schede, profili admin e appartenenze | Direttivo, HR |
| `people:links:manage` | Collegare e scollegare account, inviare inviti, risolvere conflitti | Direttivo, HR |
| `people:assignments:manage` | Nominare e revocare Team Lead e ambiti Capo Admin | Direttivo |
| `people:export` | Export dei dati personali | Direttivo |
| `census:manage` | Campagne, import, solleciti | Direttivo, HR |
| `members:read` | Libro Soci | Direttivo, HR |
| `members:write` | Scrivere il Libro Soci | Direttivo |
| `members:export` | Export del Libro Soci | Direttivo |

Implicazioni proposte: `people:write` → `people:read`; `members:write` → `members:read`. Restano da approvare, coerenti con la pratica attuale di dichiararle nell'IdP.

I permessi `azure:members:*` restano dedicati agli account Microsoft 365 e non danno accesso al Libro Soci.

### 9.2 Accessi derivati dagli incarichi (nel backend)

Non sono permessi IdP: il backend li calcola dalla scheda collegata al `sub` del chiamante.

| Condizione nel backend | Accesso |
|---|---|
| Scheda collegata | La mia area: solo la propria scheda |
| Appartenenza attiva a un team | Rubrica del team |
| `role = lead` attivo in un team | Lettura e scrittura del proprio team (§8) |
| Ambito attivo in `org_capo_admin_scopes` | Vista Capo Admin limitata all'ambito |

Così HR o il Direttivo nominano un Lead in un solo passaggio, senza dover assegnare anche un ruolo nell'IdP, e la revoca dell'incarico toglie l'accesso. Poiché chi nomina un Lead gli dà accesso a dati personali, la nomina richiede `people:assignments:manage` ed è sempre in audit con motivo.

Gli accessi globali (§9.1) e quelli derivati si sommano.

### 9.3 Accesso alla dashboard

Oggi `/dashboard` richiede `admin:access`. Proposta:

- **`/dashboard/persone/*`** e le altre sezioni operative continuano a richiedere `admin:access` più il permesso della pagina.
- **`/dashboard/me/*`** (La mia area), la pagina del proprio team e la vista Capo Admin richiedono solo una **scheda collegata**. La shell mostra soltanto queste voci a chi non ha `admin:access`.
- Il gate di `src/routes/dashboard.tsx` diventa «`admin:access` **oppure** scheda collegata». `getDashboardAccess` restituisce anche gli incarichi (`people.me.access`) per costruire la navigazione.

---

## 10. API backend (bozza)

Nuova policy accanto a `dashboard(permission)` in `src/idp/policies.ts`:

```ts
/** Signed-in dashboard users with a linked person record; the procedure checks the record relation itself. */
export const linkedPerson: Policy = { user: { scope: SCOPE.admin, linkedPerson: true } }
```

Il middleware risolve `sub → person` e lo mette nel contesto; restituisce 403 se la scheda non c'è. Le procedure con accesso derivato controllano la relazione (Lead del team X, ambito Y) nella query stessa, non solo in un controllo preliminare, così una lista non può includere righe fuori ambito.

| Router | Procedure | Policy |
|---|---|---|
| `people.persons` | `list`, `get`, `create`, `update`, `archive` | `people:read` / `people:write` |
| `people.links` | `suggest`, `invite`, `link`, `unlink`, `pending` | `people:links:manage` |
| `people.assignments` | `setTeamLead`, `setCapoAdminScope`, `end…` | `people:assignments:manage` |
| `people.admins` | `list` | `people:read` |
| `people.teams` | `list`, `get(slug)`, `members(slug)` | `people:read` |
| `people.census` | `campaigns`, `responses`, `previewImport`, `commitImport`, `remind` | `census:manage` |
| `members` | `list`, `get`, `create`, `setStatus`, `setNumber`, `importFromEntra` | `members:read` / `members:write` |
| `people.me` | `access`, `profile`, `requestChange`, `consents`, `revokeConsent`, `respond`, `acceptInvite`, `linkByTelegram` | `linkedPerson` (salvo `acceptInvite` e `linkByTelegram`: utente autenticato senza scheda) |
| `people.myTeam` | `roster`, `update…` (Lead) | `linkedPerson` + relazione |
| `people.capoAdmin` | `admins`, `groups` | `linkedPerson` + ambito |

`members.setNumber` scrive il registro e poi chiama la sincronizzazione Entra già presente (`setAssocNumber`). Se Entra rifiuta, il registro torna al numero precedente e l'errore viene mostrato.

---

## 11. Lavoro per repository

### `auth`

- Migrazione con i permessi del §9.1 e relative implicazioni; aggiunta dei nuovi prefissi alla proiezione `backend`.
- Endpoint interno di lookup del soggetto (§5.3), con scope dedicato e test di autorizzazione.
- Ruolo personalizzato **HR** e permessi aggiuntivi al ruolo gestito `direttivo`, configurati dall'interfaccia RBAC: configurazione, non codice.

### `backend`

- Schema e migrazioni del §4, con cifratura dei contatti e audit.
- Router del §10 e policy `linkedPerson`.
- Import Forms con anteprima e commit idempotente; import da Entra per il Libro Soci.
- Join persona ↔ `tg_group_admins` ↔ `tg_groups` ↔ `common_group_labels` per gruppi amministrati e ambiti Capo Admin.
- Inviti e solleciti tramite il mailer esistente (`src/emails`).

### `admin`

- Sezione Persone (§7) con le tabelle e i filtri già in uso nelle altre pagine.
- Nuovi permessi in `src/server/permissions.ts` e gate del §9.3.
- La mia area, pagina team, vista Capo Admin.
- Wizard di import con anteprima e conferma (regola AGENTS.md: nessuna azione su più righe senza conferma).

---

## 12. Fasi di rilascio

| Fase | Contenuto | Valore per chi lo usa |
|---|---|---|
| **1. Anagrafica e import** | Schema persone/team/admin, import della campagna 2026/27, Panoramica, Admin, Team per Direttivo e HR | Il censimento è in dashboard; nessuno deve registrarsi |
| **2. Libro Soci** | Registro soci, import da Entra, cambio numero tramite registro | Libro soci aggiornato e consultabile |
| **3. Collegamento account** | Lookup IdP, inviti, collegamento da operatore, La mia area in lettura | Chi accede trova i propri dati |
| **4. Viste delegate** | Team Lead, membro di team, Capo Admin, nomine | Lead e Capo Admin lavorano in autonomia |
| **5. Censimento in dashboard** | Campagna 2027/28 compilata in dashboard, consensi versionati, solleciti | Forms dismesso |
| **6. Rinnovi** | Quote annuali e ricevute (PRD §6) | — |

La fase 1 non dipende dall'IdP e si può avviare subito. Le fasi 1 e 2 possono procedere in parallelo.

---

## 13. Privacy

- Base: informativa volontari (`polinet.cc/privacy-volontari`, `/privacy-volunteers`) nella versione accettata nel modulo. Ogni campagna registra la versione dell'informativa.
- Il consenso foto/video è facoltativo e revocabile; la revoca va resa visibile a Design & Social.
- **Retention da decidere**: proposta di archiviare i volontari usciti dopo 12 mesi dalla fine dell'incarico, conservando nome, ruoli e date; contatti e risposte vanno cancellati. I dati del Libro Soci seguono gli obblighi associativi.
- Gli export sono soggetti a permesso e audit.

---

## 14. Decisioni aperte

1. **Corso di studi e ambiti Capo Admin**: elenco chiuso o testo libero (PRD §19 punto 8)? Gli ambiti coincidono con le etichette dei gruppi?
2. **Lookup IdP** (§5.3): endpoint dedicato o proiezione estesa?
3. **Accesso alla dashboard senza `admin:access`** (§9.3): va bene aprire la shell a chi ha solo una scheda collegata, o La mia area deve essere un'applicazione separata?
4. **Campi specifici dei team** (§4.4): da definire con ciascun Lead.
5. **Contatti visibili a HR e ai Team Lead** (§8.1, PRD §19 punto 6).
6. **Retention** dei volontari usciti (§13).
7. **Team Lead e nuove persone**: un Lead può creare una scheda nuova o solo aggiungere persone già censite?
8. **Membri di team e Libro Soci**: un membro di team deve sapere chi del proprio team è socio? Proposta: no.
