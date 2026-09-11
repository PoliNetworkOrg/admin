# Design — Identity Provider PoliNetwork

**Documento collegato:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) §2.6 · [`PRD_Classificazione_Feature.md`](./PRD_Classificazione_Feature.md) #0
**Versione:** 1.0
**Data:** 30 agosto 2026
**Base tecnica:** Better Auth (già in uso in `@polinetwork/backend`, Drizzle/Postgres)

## 0. Cosa esiste già (verificato nel codice)

Prima di progettare da zero, questo è lo stato reale:

- **Login attuale**: email OTP + passkey (`better-auth`, `emailOTPClient`, `@better-auth/passkey`) — `src/features/auth/login-page.tsx`. **Non è già legato a Telegram**: si accede con email personale o passkey.
- **Collegamento Telegram**: già esiste come step separato, post-login, a flusso opzionale — `src/features/onboarding/telegram-link-page.tsx`, `use-telegram-link.ts`. Meccanismo: `auth.telegram.link.start({telegramUsername})` genera un codice con TTL (tabella `tg.link` nel backend), l'utente lo usa lato Telegram, poi `auth.telegram.link.verify({code})` conferma. Il record `user` di Better Auth ha già le colonne `telegramId`/`telegramUsername`.
- **Il blocco**: `authorizeAdmin` (`src/server/auth.server.ts`) oggi **richiede** `telegramId` per accedere alla dashboard — se manca, ritorna `"telegram-unlinked"` e i ruoli/capacità vengono letti **solo** dalla tabella `permissions` del bot Telegram (keyed by Telegram user id). Quindi l'identità dashboard dipende ancora, di fatto, da Telegram per l'autorizzazione, anche se non per il login.
- **Email**: l'invio (OTP, notifiche) passa già da Microsoft Graph (`AZURE_EMAIL_SENDER=noreply@polinetwork.org`), non da un SMTP dedicato — riusabile as-is per nuovi flussi email.
- **Azure**: integrazione esistente solo per gestione directory/gruppi (Microsoft Graph), non per login — nessun "Sign in with Microsoft" oggi.
- **polinet.cc**: repository e dominio separati, non nel monorepo — niente cookie condivisibili di default.

Il lavoro da fare, quindi, non è "costruire un IdP da zero" ma: **scollegare l'autorizzazione da Telegram, aggiungere il collegamento account Politecnico con lo stesso pattern già validato per Telegram, ed estendere la stessa identità Better Auth ad altri servizi via OIDC.**

---

## 1. Principio guida

Un'unica identità PoliNetwork per persona (`user.id` di Better Auth), a cui si **collegano** più identificativi verificati indipendenti — nessuno dei quali è obbligatorio per esistere come identità, ma alcuni sono richiesti per ottenere certe capacità:

```
                    ┌─────────────────────────┐
                    │   Identità PoliNetwork   │   (Better Auth user)
                    │  creata via email/passkey│
                    └────────────┬────────────┘
                                 │ fatti/collegamenti indipendenti, aggiungibili in qualsiasi momento
       ┌──────────────┬──────────┴──────────┬──────────────┐
       ▼               ▼                     ▼              ▼
  Telegram account  Affiliazione        Record Socio    Passkey
  (già esistente,   Politecnico         (claim via       (già esistente,
   opzionale)        (NUOVO — codice     codice, NUOVO)   2FA/accesso rapido)
                      via mail @polimi)
```

Nessuno di questi collegamenti è "il" login: il login primario resta **sempre** email personale (OTP) o passkey — usato da chiunque, che sia uno studente sul sito pubblico, un socio, o un admin. I quattro collegamenti sono **fatti indipendenti** sulla stessa identità, nessuno implica gli altri (coerente con PRD §1.2 — Socio, Admin, membro di team sono già definite come categorie indipendenti; qui aggiungiamo "affiliazione Politecnico" come quarto asse, altrettanto indipendente):

- **Telegram collegato** → prova di appartenenza al canale operativo Telegram, alimenta i ruoli legacy.
- **Politecnico verificato** → prova che la persona è o è stata studente del Politecnico. Non implica essere socio, non implica avere accesso alla dashboard.
- **Record Socio collegato** → prova che la persona è (o è stata) iscritta e in regola con la quota. Non implica essere admin, non implica essere del Politecnico (in linea di principio un socio potrebbe non esserlo).
- **Ruolo admin/team** (via `capability_grant`, §4 sotto) → prova di un ruolo organizzativo. Non implica essere socio né avere Telegram.

Un'altra implicazione di questo modello: **la stessa identità e lo stesso login servono anche il sito pubblico PoliNetwork**, non solo la dashboard interna. Chiunque arrivi dal sito con la propria email personale ottiene la stessa identità — se poi verifica l'affiliazione Politecnico o risulta socio, sblocca le aree corrispondenti sul sito stesso. L'IdP non è quindi "l'accesso alla dashboard admin": è l'identità unica di chiunque interagisca con l'ecosistema PoliNetwork (sito pubblico, area soci, dashboard interna, polinet.cc, futuri servizi).

---

## 2. Collegamento affiliazione Politecnico (nuovo)

Stesso schema UX già validato per Telegram, invertito nel canale: invece di un codice generato in dashboard e inserito su Telegram, un codice inviato per email istituzionale e inserito in dashboard (identico, concettualmente, all'OTP di login già esistente).

**Cosa significa questo collegamento, esattamente**: attesta il fatto "questa persona è o è stata studente del Politecnico" — un'affiliazione, non uno status di socio. Non fa fede su iscrizione, corso, anno o quota: è solo la prova che la persona ha accesso a una casella email istituzionale del Politecnico. Resta un fatto indipendente accanto a Socio e Admin (vedi diagramma in §1).

### Flusso

1. L'utente è già autenticato (sessione attiva) — sul sito pubblico o in dashboard, indifferentemente. Da un'area "Account"/"Il mio profilo" apre "Verifica il tuo account Politecnico".
2. Inserisce il proprio indirizzo istituzionale. L'input è validato contro un **allowlist di domini configurabile**: al momento **`@mail.polimi.it`** e **`@polimi.it`** (gli unici confermati). L'allowlist va tenuta come tabella/config, non hardcoded, per poter aggiungere altri atenei in futuro senza saperli oggi.
3. Il backend genera un codice a 6 cifre con TTL breve (10 minuti, stesso ordine di grandezza del TTL già usato in `tg.link`), lo salva in una nuova tabella `institutional_email_link` (`userId`, `email`, `code`, `expiresAt`, `verifiedAt`), e lo invia via Microsoft Graph — stesso canale email già in uso per l'OTP di login, nessuna nuova infrastruttura di invio.
4. L'utente inserisce il codice (stesso componente UI dell'OTP di login, riusato).
5. Il backend verifica codice e scadenza, marca l'indirizzo come verificato, scrive l'evento nell'audit unificato (§2.2 del PRD).
6. L'indirizzo verificato viene salvato su `user.institutionalEmail` / `institutionalEmailVerifiedAt` (stesso pattern delle colonne `telegramId`/`telegramUsername` già presenti sulla riga `user`).

### Cosa sblocca

- Un badge/flag "Politecnico verificato" utilizzabile sia sul sito pubblico (es. contenuti riservati agli studenti) sia come dato di supporto in fase di domanda di iscrizione a socio (§3.1 del PRD) — **non** un'iscrizione automatica: resta un operatore a validare la domanda.
- Base per un eventuale matching futuro con la directory Azure/Entra del Politecnico, se mai disponibile (oggi l'Azure esistente è il tenant di PoliNetwork, non quello dell'ateneo).
- **Non** sostituisce la firma della privacy policy (§2.5) né l'iscrizione a socio: resta un collegamento di identità, non un flusso di associazione.

---

## 3. Collegamento al record Socio (claim tramite codice — terza istanza dello stesso pattern)

**Perché non "usa la mail PoliNetwork per accedere all'area soci"**: non tutti quelli che accedono alla dashboard sono soci, e non tutti i soci hanno (o avranno mai) una casella @polinetwork.org. Usare quella mail come credenziale per l'area soci escluderebbe soci senza mail istituzionale e confonderebbe due categorie che il PRD tiene esplicitamente separate (§1.2). La stessa obiezione vale per "far validare l'account personale con la mail PoliNetwork": funziona solo per chi quella mail ce l'ha, cioè in pratica solo admin/team — non la popolazione dei soci in generale.

**Soluzione proposta — un terzo codice, come per Telegram e Politecnico**: quando un socio viene approvato (flusso §3.1 del PRD: richiesta → verifica → deduplica → firma privacy → approvazione → numero associativo), il sistema invia all'indirizzo email fornito in fase di iscrizione un **codice di claim** legato al numero associativo appena generato — non un nuovo canale, lo stesso meccanismo di invio già usato per Telegram/Politecnico.

### Flusso

1. Il Direttivo (o ruolo autorizzato) approva l'iscrizione in Anagrafica Soci; viene generato il numero associativo (già previsto dal PRD §3.1).
2. Il backend crea un codice di claim con TTL più lungo del solito (es. alcuni giorni, dato che la persona potrebbe non avere ancora un account PoliNetwork), salvato in `membership_claim` (`numeroAssociativo`, `email`, `code`, `expiresAt`, `claimedByUserId`).
3. Il codice viene inviato via email all'indirizzo fornito in iscrizione (stesso invio Graph).
4. La persona, se non ha già un'identità PoliNetwork, si registra con la sua email personale (login standard, §"Principio guida"); se ce l'ha già, usa quella.
5. Da un'area "Collega il mio tesseramento", inserisce il codice ricevuto. Il backend verifica codice+TTL e collega `user.id` al record Socio corrispondente.
6. Da questo momento la persona ha lo stesso login di sempre, ma la sua identità risulta anche "Socio attivo" — con accesso all'area riservata soci sul sito e alle funzioni di rinnovo (§6 del PRD).

Questo riusa esattamente l'infrastruttura di codice+TTL+email già scritta per Telegram e (dopo il punto 2) per Politecnico — non è un sistema nuovo, è la stessa primitiva applicata una terza volta a un caso diverso.

---

## 4. RBAC indipendente da Telegram

Oggi l'autorizzazione (`authorizeAdmin`) fallisce con `"telegram-unlinked"` se l'utente non ha un Telegram collegato, e i ruoli arrivano solo dalla tabella `permissions` del bot (keyed by Telegram id). Questo rende impossibile, per costruzione, dare accesso dashboard a chi non ha (o non vuole) un account Telegram — un problema per Capo Admin, HR, o futuri ruoli Finance (PRD §19, punto 9) che potrebbero non passare da Telegram.

Proposta (coerente con PRD §2.1):

- Nuova tabella `capability_grant`: `subjectUserId`, `capability` (es. `members.read`, `members.write`, `telegram.moderate`, `azure.manage`, `content.write`, `governance.read`, `audit.read`), `scopeType` (`none` / `course` / `team`), `scopeValue`, `grantedBy`, `grantedAt`, `revokedAt`.
- `authorizeAdmin` viene **esteso**, non sostituito: continua a leggere i ruoli Telegram esistenti quando presenti (retrocompatibilità esplicitamente richiesta dal PRD §2.1) e li mappa a capacità implicite (`owner`/`direttivo`/`president` → tutte le capacità; `hr` → sola lettura), poi li unisce alle eventuali `capability_grant` dirette sull'utente.
- Risultato: un utente **senza** Telegram collegato ma con una `capability_grant` diretta può comunque accedere alla dashboard con le capacità assegnate — Telegram diventa una delle fonti di autorizzazione, non l'unica.
- Il popolamento iniziale di `capability_grant` per gli owner/direttivo attuali è un one-off di migrazione, non un flusso utente.

---

## 5. Single sign-on sugli altri servizi (sito pubblico, polinet.cc, futuri)

`polinet.cc` è un repository e (presumibilmente) un dominio diverso da `polinetwork.org`: i cookie di sessione di Better Auth non attraversano domini diversi. Lo stesso vale, quasi certamente, per il sito pubblico se vive su un dominio o deploy separato dalla dashboard. Condividere solo il cookie non basta — serve un vero provider OAuth2/OIDC.

Con la conferma che l'IdP serve **anche il sito pubblico** (non solo la dashboard interna), il sito pubblico è probabilmente il primo consumer reale di questo provider — più di polinet.cc — perché è lì che gli studenti verificano l'affiliazione Politecnico e i soci fanno il claim del tesseramento (§3 sopra). Va scoping-ato per primo con chi lavora al sito.

### Proposta

- Attivare il plugin **`oidcProvider`** di Better Auth sulla stessa istanza server già presente in `@polinetwork/backend` (quella usata oggi da `admin`), trasformandola in un Identity Provider OIDC standard con gli endpoint `/authorize`, `/token`, `/userinfo`, `/.well-known/openid-configuration` e JWKS.
- Ogni servizio (sito pubblico, Admin Dashboard, polinet.cc, futuri strumenti interni) viene registrato come **client OAuth2** con `client_id`/`client_secret` e redirect URI propri.
- Ogni servizio implementa "Accedi con PoliNetwork" come flusso standard Authorization Code + PKCE, invece di reimplementare email OTP/passkey/OTP Politecnico da zero — un solo posto dove vive la logica di autenticazione.
- L'ID token / `userinfo` espone claim minime e stabili: `sub`, `email`, eventualmente `telegramId`/`telegramUsername` se collegato. **Le capacità/ruoli non vanno incluse nel token**: cambiano più spesso di quanto un token duri, e obbligherebbero a invalidarlo ad ogni modifica di permesso. Ogni servizio le richiede al bisogno a un endpoint dedicato del backend (stesso pattern di `authorizeAdmin` oggi), passando lo scope che gli serve — polinet.cc, ad esempio, potrebbe aver bisogno solo di "socio sì/no", non delle capacità da dashboard admin.
- Con una sessione IdP già attiva (es. utente già loggato in dashboard), l'`/authorize` su un secondo servizio non richiede di reinserire email/OTP: è SSO silenzioso, non un secondo login.

### Non-obiettivo

Non si sposta la sessione applicativa di ogni servizio sull'IdP: ogni app mantiene il proprio cookie di sessione locale (dominio proprio) dopo lo scambio OIDC iniziale. L'IdP centralizza solo l'autenticazione, non lo stato di sessione di ogni app.

---

## 6. Cosa cambia, cosa resta

| | Oggi | Con questo design |
|---|---|---|
| Login primario | Email OTP / passkey | Invariato — usato anche da chi arriva dal sito pubblico |
| Telegram | Obbligatorio per autorizzazione dashboard | Opzionale — collegabile in qualsiasi momento, resta il canale operativo per il bot |
| Affiliazione Politecnico | Non esiste | Collegabile post-login, stesso pattern a codice del collegamento Telegram. Fatto indipendente, non implica Socio |
| Record Socio | Solo in Anagrafica Soci, non collegato a un'identità di login | Claim tramite codice (§3), fatto indipendente, non implica Admin né Politecnico |
| Ruoli/capacità | Solo da `permissions` Telegram, richiede `telegramId` | `capability_grant` diretta + ruoli Telegram come caso particolare (retrocompatibile) |
| Accesso da altri servizi | Nessuno (ogni servizio è isolato) | OIDC provider condiviso, "Accedi con PoliNetwork" su sito pubblico, polinet.cc e futuri servizi |

---

## 7. Decisioni aperte (da aggiungere a PRD §19)

1. ~~Quali domini email istituzionali sono ammessi al collegamento Politecnico~~ — **risolto**: `@mail.polimi.it` e `@polimi.it`. Resta aperto se/quando estendere ad altri atenei (allowlist va comunque tenuta configurabile, non hardcoded).
2. Chi genera il codice di claim del tesseramento (§3): è un'azione automatica all'approvazione dell'iscrizione, o un'azione manuale di chi approva?
3. Cosa succede se l'email usata in fase di iscrizione a socio (§3.1) è diversa dall'email con cui la persona poi crea/ha già la propria identità PoliNetwork? Il claim va comunque per codice indipendentemente dall'email di login, ma va deciso se re-inviare il codice a una nuova email è permesso e chi lo autorizza.
4. Chi assegna le prime `capability_grant` dirette e con quale processo (one-off di migrazione vs. richiesta tramite Onboarding, §8)?
5. Il plugin `oidcProvider` di Better Auth va verificato contro la versione installata (`better-auth@1.5.5`) per compatibilità, requisiti di persistenza (client registration, consent screen) e maturità, prima di confermare la stima di difficoltà in §1 della classificazione.
6. Il sito pubblico è il primo consumer reale dell'OIDC provider (probabile, vista la conferma che l'IdP lo serve): va scoping-ato con chi lavora al sito per definire l'ordine reale di implementazione della SSO multi-servizio, prima o insieme a polinet.cc.
