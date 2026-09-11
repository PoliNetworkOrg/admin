# Ruoli e permessi — Admin Dashboard PoliNetwork

**Documenti collegati:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) §1, §2.1 · [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) §4 (RBAC)
**Versione:** 1.0
**Data:** 30 agosto 2026
**Esclusioni:** pagine di caricamento annunci (§15 Bacheca casa e coinquilini) — assumo sia questo il riferimento; segnalamelo se intendevi altro.

## 0. Principio

Non ruoli monolitici, ma **capacità granulari per modulo** (lettura/scrittura/approvazione), come richiesto dal PRD §2.1. I "ruoli" qui sotto sono **preset** di capacità pensati per velocizzare l'assegnazione — restano assegnabili anche singolarmente e in combinazione libera (es. Content Editor + Telegram Moderator, esempio già citato nel PRD). Nessun ruolo è esclusivo: una persona può averne più di uno.

Due famiglie di ruoli:
- **Ruoli di gerarchia** (§1.3 del PRD) — legati alla posizione organizzativa, ampiezza dei permessi decrescente.
- **Ruoli funzionali** — legati a una competenza/team, indipendenti dalla gerarchia, combinabili liberamente.

---

## 1. Catalogo capacità (per pagina/modulo)

| Capacità | Pagine coperte | Livelli |
|---|---|---|
| `members` | Anagrafica Soci (§3.1) | read / write |
| `members.sensitive` | Campi sensibili anagrafica (contatti personali, eventuale codice fiscale) | read / write — sotto-permesso di `members`, non implicito |
| `admin_census` | Censimento Admin/Team (§3.2) | read / write |
| `capoadmin_view` | Vista Capo Admin (§5) | read, **sempre scoped** al proprio corso/ambito |
| `renewals` | Gestione Soci e Rinnovi (§6): coda ricevute, approvazione, reminder | read / approve |
| `teams` | Aree Team interni (§7) | read / write, **scoped** al team |
| `onboarding` | Onboarding self-service, richieste in ingresso (§8) | read / approve |
| `telegram.users` | Telegram → Users (esistente) | read / write |
| `telegram.groups` | Telegram → Groups (esistente) | read / write |
| `telegram.grants` | Telegram → Grants (esistente) | read / write |
| `azure.groups` | Azure → Groups (esistente) | read / write |
| `azure.members` | Azure → Members / licenze (esistente) | read / write |
| `content.guides` | Web → Guides (esistente, + workflow bozza/pubblicazione §11) | read / write / publish |
| `content.faq` | FAQ pubbliche (§10) | read / write / publish |
| `content.projects` | Web → Projects (esistente) | read / write |
| `associations.accounts` | Gestione account/referenti associazioni partner (§12) | read / write |
| `associations.requests` | Approvazione richieste pubblicazione e pagina pubblica associazioni (§12) | read / approve |
| `events.politamtam` | Approvazione eventi PoliTamTam (§13) | read / approve |
| `companies` | Area Aziende (§14) — placeholder, da definire con lo scope | read / write |
| `newsletter` | Composizione/invio newsletter (§16) | write / send |
| `audit.read` | Log di audit (§2.2) | read |
| `rbac.manage` | Assegnazione capacità dirette, scope Capo Admin, ruoli di gerarchia | write — **la capacità più sensibile, richiede sempre conferma esplicita** |
| `membership.self` | Propria scheda in Anagrafica Soci: dati, storico, stato rinnovo (§3.1) | read (solo il proprio record) |
| `membership.self.renew` | Caricamento propria ricevuta di bonifico, stato della propria richiesta di rinnovo (§6) | write (solo sul proprio record) |
| `membership.self.consents` | Firma/consultazione dei propri consensi privacy (§2.5) | read / write (solo i propri) |

Non hanno una capacità dedicata: **Home/Overview** e **Account personale** — sempre accessibili a chiunque abbia un'identità autenticata, indipendentemente dalle capacità possedute (ognuno vede sempre qualcosa di suo, come richiesto dal PRD §8).

---

## 2. Ruoli di gerarchia (§1.3 del PRD)

| Ruolo | Capacità di default | Note |
|---|---|---|
| **Owner** | Tutte, incluso `rbac.manage` | Unico livello con pieno controllo su chi ha accesso a cosa. |
| **Direttivo** | Tutte tranne `rbac.manage` | Accesso e scrittura completi come da PRD §1.1; l'assegnazione di capacità dirette resta riservata a Owner (o delegabile, §19 punto 4 del design IdP). |
| **Presidente** | Come Direttivo | Più la firma esplicita dei rinnovi Direttivo→associazione quando richiesta (§6). |
| **Capo Admin** | `capoadmin_view` (scoped), `admin_census` read (scoped), `telegram.groups`/`telegram.users` read (scoped ai gruppi di competenza), `onboarding` approve (solo per richieste che risalgono a lui, §8) | Tutto **scoped** al proprio corso/ambito — mai visibilità globale. |
| **Admin (operativo)** | Solo Account personale + propria area Onboarding | Nessuna capacità di lettura/scrittura su altri moduli finché non riceve capacità funzionali aggiuntive. |
| **HR** | `members` read, `admin_census` **read/write**, `onboarding` **read/write (approve)** | Scrittura su Censimento Admin/Team e su Onboarding (colloqui, candidature — coerente con PRD §8, dove il processo di candidatura va definito "con HR e Team IT"). Resta **sola lettura** sull'Anagrafica Soci, come esplicitamente richiesto dal PRD §3.3 — il dettaglio su `members.sensitive` resta comunque una decisione aperta (PRD §19 punto 6). |
| **Socio** | `membership.self`, `membership.self.renew`, `membership.self.consents` | **Non è un livello della gerarchia amministrativa**: è l'asse indipendente definito dal PRD §1.2. Lo includo qui perché, in termini di accesso alla dashboard, un Socio senza alcun ruolo admin ha comunque capacità concrete e proprie (vedere la propria scheda, caricare la ricevuta di rinnovo, firmare i consensi) — più di un Admin operativo "nudo" senza capacità funzionali aggiuntive. Una persona può essere Socio e Admin insieme: le capacità si sommano, non si sostituiscono (§1.2 del PRD). |

`creator` (ruolo Telegram) resta escluso da qualunque accesso dashboard, come già specificato nel PRD §1.1 — non compare qui perché non è un ruolo dashboard.

---

## 3. Ruoli funzionali (indipendenti dalla gerarchia, combinabili)

| Ruolo | Capacità | Tipicamente assegnato a |
|---|---|---|
| **Content Editor** | `content.guides` write/publish, `content.faq` write/publish, `content.projects` write, `newsletter` write | Team Design & Social |
| **Telegram Moderator** | `telegram.users` write, `telegram.groups` write, `telegram.grants` write | Team IT / admin operativi con delega specifica |
| **Azure Manager** | `azure.groups` write, `azure.members` write | Team IT |
| **Membership Officer** ("Finance", PRD §19 punto 9) | `renewals` approve | Direttivo di default; ruolo dedicato se PoliNetwork decide di scorporarlo (decisione ancora aperta nel PRD) |
| **Team Lead** | `teams` write, **scoped al proprio team** | Responsabile di uno dei team interni (IT, Design & Social, International, HR, Events & Partnerships) |
| **Association Liaison** | `associations.accounts` write, `associations.requests` approve, `events.politamtam` approve | Team Events & Partnerships |
| **Onboarding Reviewer** | `onboarding` approve (non scoped) | Direttivo/HR per i colloqui, o delegabile |
| **Auditor** | `audit.read` | Direttivo/Owner di default; assegnabile a chi deve verificare la conformità senza avere capacità di scrittura altrove |

---

## 4. Regole trasversali

- **Conferma esplicita obbligatoria** (PRD §2.1) su ogni azione ad alto impatto: cancellazioni, assegnazione/revoca ruoli, rimozione da gruppi, export dati personali, qualunque uso di `rbac.manage`.
- **Scoping**: `capoadmin_view`, `admin_census` (per Capo Admin) e `teams` (per Team Lead) non sono mai capacità globali — portano sempre un `scopeType`/`scopeValue` (corso, team). Questo è già il modello dati proposto in `IdentityProvider_Design.md` §4.
- **Nessuna capacità implica le altre**: avere `members` non dà `members.sensitive`; avere `teams` su un team non dà visibilità sugli altri team; avere `content.guides` non dà `content.faq`. Le combinazioni vanno assegnate esplicitamente.
- **Le capacità `self`** (`membership.self*`) sono strutturalmente diverse dalle altre: non richiedono un `rbac.manage` per essere assegnate, derivano automaticamente dal collegamento dell'identità al proprio record Socio (claim tramite codice, `IdentityProvider_Design.md` §3) — chiunque abbia claim-ato un tesseramento le ottiene sul proprio record, mai su quello di altri.
- **Audit obbligatorio** prima di esporre dati personali a più ruoli (PRD §17) — vale in particolare per `members.sensitive` e `admin_census`.

---

## 5. Cosa resta da decidere con voi

1. `members.sensitive` — quali campi rientrano davvero (codice fiscale sì/no è ancora aperto nel PRD, §19 punto 5) e se HR li vede o restano mascherati anche per HR (PRD §19 punto 6).
2. Se "Membership Officer/Finance" diventa un ruolo reale distinto o resta capacità del solo Direttivo (PRD §19 punto 9).
3. Se `onboarding` approve per le candidature nuove (non i rinnovi di interesse) richiede un ruolo dedicato (es. HR + un membro del Direttivo insieme) invece che essere una capacità singola.
4. Se `companies` (Area Aziende, §14) merita un ruolo funzionale proprio — dipende dallo scope, ancora da progettare.
