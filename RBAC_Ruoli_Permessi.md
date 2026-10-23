# Ruoli e permessi — Admin Dashboard PoliNetwork

**Documenti collegati:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) §1, §2.1 · [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) §4 (RBAC) · [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md) (schema implementato e proposte residue)
**Versione:** 2.0
**Data:** 12 ottobre 2026
**Esclusioni:** pagine di caricamento annunci (§15 Bacheca casa e coinquilini), non coperte da capacità dedicate.

## 0. Contratto implementato

L'IdP `auth` è la fonte dei ruoli e permessi globali, con assegnazioni tramite `user_role`, ereditarietà dei ruoli e implicazioni dei permessi. Il backend controlla scope del client e permessi della persona per procedura; admin legge `me.access` e verifica gli stessi permessi nel BFF. Fonti fissate agli SHA in PRD §20.

L'accesso a `/dashboard` richiede `admin:access`: Home/Overview e Account **della dashboard** non sono accessibili a qualunque persona autenticata. L'account personale IdP è distinto. Telegram collegato non è obbligatorio e non assegna ruoli. I nomi legacy sono inventario da riconciliare, non preset applicati automaticamente; il veto globale `creator` è superato.

### 0.1 Permessi verificati dalla dashboard

| Permesso | Ambito implementato |
|---|---|
| `admin:access` | Accesso dashboard e letture di dati pubblici |
| `tg:users:read`, `tg:messages:read`, `tg:audit:read` | Utenti, messaggi e audit Telegram |
| `tg:groups:manage` | Gestione gruppi Telegram |
| `tg:grants:read`, `tg:grants:manage` | Lettura e gestione grant |
| `wa:groups:manage` | Gruppi WhatsApp |
| `groups:labels:write` | Scrittura etichette comuni ai gruppi |
| `web:content:write` | Mutazioni FAQ, guide, progetti, associazioni e pubblicazione gruppi per etichetta |
| `web:reports:manage` | Gestione segnalazioni link |
| `azure:members:read`, `azure:members:create` | Directory Microsoft 365 in sola lettura e workflow dedicato di creazione |
| `azure:groups:read`, `azure:groups:write` | Lettura gruppi e aggiunta/rimozione di utenti esistenti; il picker richiede anche `azure:members:read` |

Sono chiavi esatte: l'interfaccia non deduce `read` da `write` per prefisso. Le implicazioni sono risolte dall'IdP. Il catalogo per la moderazione bot è più ampio (`tg:ban`, `tg:trusted`, `tg:immune`, ecc.): si segue la RFC v3, non la proposta a chiave+livello sotto.

### 0.2 Ruoli gestiti e amministrazione

- `master-admin`: wildcard su tutti i permessi, derivato dall'allowlist di bootstrap o dal gruppo Entra configurato; non assegnabile come un ruolo personalizzato, non ereditabile.
- `socio`, `direttivo`: appartenenza derivata dai gruppi Entra; nessuna equivalenza automatica con quota pagata/storico associativo. `socio` ha il permesso iniziale `membership:read`.
- `student`: verifica della mail `@mail.polimi.it`, con permesso iniziale `student:verified`.
- Ruoli personalizzati: bundle assegnabili, con ereditarietà. Presidente, HR, Capo Admin e ruoli funzionali non hanno i preset di prodotto sotto assegnati automaticamente.

La gestione usa `idp:permissions:read/write`, `idp:roles:read/write/assign`, `idp:people:read`, `idp:users:read/delete`, `idp:applications:read/write`. Modificare ruoli e assegnarli sono permessi distinti; la delega è limitata ai permessi correnti dell'operatore. Le mutazioni RBAC sono auditate atomicamente. Le implicazioni esistono: la vecchia regola «nessuna capacità implica le altre» non descrive l'implementazione.

Lo scoping corso/team non è implementato. Va progettato insieme al backend prima di esporre viste Capo Admin o Team Lead su dati di altre persone.

---

## 1. Requisiti di capacità per i moduli futuri (proposta)

Questa tabella conserva i requisiti di prodotto non ancora implementati. Le chiavi e i livelli sono descrittivi, **non** endpoint o permessi registrati oggi; vanno tradotti nel catalogo IdP. La precedente tabella `capability_grant` non è stata adottata.

| Capacità | Pagine coperte | Livelli |
|---|---|---|
| `members` | Anagrafica Soci (§3.1) | read / write |
| `members.sensitive` | Campi sensibili anagrafica (contatti personali, eventuale codice fiscale) | read / write — sotto-permesso di `members`, non implicito |
| `admin_census` | Censimento Admin/Team (§3.2) | read / write |
| `capoadmin_view` | Vista Capo Admin (§5) | read, **sempre scoped** al proprio corso/ambito |
| `renewals` | Gestione Soci e Rinnovi (§6): coda ricevute, approvazione, reminder | read / approve |
| `teams` | Aree Team interni (§7) | read / write, **scoped** al team |
| `onboarding` | Onboarding self-service, richieste in ingresso (§8) | read / approve |
| `associations.accounts` | Gestione account/referenti associazioni partner (§12) | read / write |
| `associations.requests` | Approvazione richieste pubblicazione e pagina pubblica associazioni (§12) | read / approve |
| `events.politamtam` | Approvazione eventi PoliTamTam (§13) | read / approve |
| `companies` | Area Aziende (§14) — placeholder, da definire con lo scope | read / write |
| `newsletter` | Composizione/invio newsletter (§16) | write / send |
| `membership.self` | Propria scheda in Anagrafica Soci: dati, storico, stato rinnovo (§3.1) | read (solo il proprio record) |
| `membership.self.renew` | Caricamento propria ricevuta di bonifico, stato della propria richiesta di rinnovo (§6) | write (solo sul proprio record) |
| `membership.self.consents` | Firma/consultazione dei propri consensi privacy (§2.5) | read / write (solo i propri) |

Per nuove aree personali soci/onboarding va deciso se estendere la dashboard o un'applicazione separata: oggi `admin:access` resta richiesto per l'admin.

---

## 2. Preset organizzativi desiderati (proposta, §1.3 del PRD)

| Ruolo | Capacità di default | Note |
|---|---|---|
| **Owner** | Amministrazione completa secondo una delega approvata | Distinguere responsabilità organizzativa e bootstrap Master Admin; nessun mapping automatico. |
| **Direttivo** | Permessi dei nuovi registri e processi associativi da approvare | Il ruolo gestito esiste; accesso dashboard e deleghe operative restano espliciti nel catalogo IdP. |
| **Presidente** | Come Direttivo | Più la firma esplicita dei rinnovi Direttivo→associazione quando richiesta (§6). |
| **Capo Admin** | `capoadmin_view` (scoped), `admin_census` read (scoped), lettura utenti/gruppi Telegram con futuro scope sui record, `onboarding` approve (solo per richieste che risalgono a lui, §8) | Tutto **scoped** al proprio corso/ambito — mai visibilità globale. |
| **Admin (operativo)** | Solo Account personale + propria area Onboarding | Nessuna capacità di lettura/scrittura su altri moduli finché non riceve capacità funzionali aggiuntive. |
| **HR** | `members` read, `admin_census` **read/write**, `onboarding` **read/write (approve)** | Scrittura su Censimento Admin/Team e su Onboarding (colloqui, candidature — coerente con PRD §8, dove il processo di candidatura va definito "con HR e Team IT"). Resta **sola lettura** sull'Anagrafica Soci, come esplicitamente richiesto dal PRD §3.3 — il dettaglio su `members.sensitive` resta comunque una decisione aperta (PRD §19 punto 6). |
| **Socio** | `membership.self`, `membership.self.renew`, `membership.self.consents` | **Non è un livello della gerarchia amministrativa**: è l'asse indipendente definito dal PRD §1.2. Lo includo qui perché, in termini di accesso alla dashboard, un Socio senza alcun ruolo admin ha comunque capacità concrete e proprie (vedere la propria scheda, caricare la ricevuta di rinnovo, firmare i consensi) — più di un Admin operativo "nudo" senza capacità funzionali aggiuntive. Una persona può essere Socio e Admin insieme: le capacità si sommano, non si sostituiscono (§1.2 del PRD). |

Questi preset non sono il catalogo runtime. In particolare Owner non è automaticamente Master Admin; Direttivo/Presidente non ricevono automaticamente tutti i permessi; Socio non dispone ancora dei flussi `membership.self*`. La precedente esclusione globale `creator` non si applica al percorso IdP.

---

## 3. Preset funzionali desiderati (proposta)

| Ruolo | Capacità | Tipicamente assegnato a |
|---|---|---|
| **Content Editor** | `web:content:write` per il CRUD attuale; permessi publish distinti e newsletter da progettare | Team Design & Social |
| **Telegram Moderator** | Permessi `tg:*` approvati secondo le azioni del catalogo RFC, senza un write generico | Team IT / admin operativi con delega specifica |
| **Azure Manager** | `azure:members:read/create`, `azure:groups:read/write`; licenze/access review da progettare | Team IT |
| **Membership Officer** ("Finance", PRD §19 punto 9) | `renewals` approve | Direttivo di default; ruolo dedicato se PoliNetwork decide di scorporarlo (decisione ancora aperta nel PRD) |
| **Team Lead** | `teams` write, **scoped al proprio team** | Responsabile di uno dei team interni (IT, Design & Social, International, HR, Events & Partnerships) |
| **Association Liaison** | `associations.accounts` write, `associations.requests` approve, `events.politamtam` approve | Team Events & Partnerships |
| **Onboarding Reviewer** | `onboarding` approve (non scoped) | Direttivo/HR per i colloqui, o delegabile |
| **Auditor** | `tg:audit:read` per lo storico Telegram; lettura audit unificato da progettare | Direttivo/Owner di default; assegnabile a chi deve verificare la conformità senza avere capacità di scrittura altrove |

---

## 4. Regole trasversali

- **Conferma esplicita obbligatoria** (PRD §2.1) su ogni azione ad alto impatto: cancellazioni, assegnazione/revoca ruoli, rimozione da gruppi, export dati personali, amministrazione sensibile tramite i permessi `idp:*` pertinenti.
- **Scoping**: `capoadmin_view`, `admin_census` (per Capo Admin) e `teams` (per Team Lead) non sono mai capacità globali — portano sempre un `scopeType`/`scopeValue` (corso, team). Sono requisiti da implementare: il modello globale IdP attuale non contiene questi campi.
- **Separazione dei nuovi dati:** non concedere implicitamente campi sensibili o visibilità su altri team/corsi. Le eventuali implicazioni del nuovo catalogo vanno deliberate nell’IdP, che già supporta implicazioni transitive.
- **Le capacità `self`** (`membership.self*`) sono requisiti futuri per il solo proprio record: nel disegno proposto derivano dal collegamento dell'identità al proprio record Socio (claim tramite codice, `IdentityProvider_Design.md` §3) — chiunque abbia claim-ato un tesseramento le ottiene sul proprio record, mai su quello di altri.
- **Audit obbligatorio** prima di esporre dati personali a più ruoli (PRD §17) — vale in particolare per `members.sensitive` e `admin_census`.

---

## 5. Decisioni aperte

1. `members.sensitive` — quali campi rientrano davvero (codice fiscale sì/no è ancora aperto nel PRD, §19 punto 5) e se HR li vede o restano mascherati anche per HR (PRD §19 punto 6).
2. Se "Membership Officer/Finance" diventa un ruolo reale distinto o resta capacità del solo Direttivo (PRD §19 punto 9).
3. Se `onboarding` approve per le candidature nuove (non i rinnovi di interesse) richiede un ruolo dedicato (es. HR + un membro del Direttivo insieme) invece che essere una capacità singola.
4. Se `companies` (Area Aziende, §14) merita un ruolo funzionale proprio — dipende dallo scope, ancora da progettare.
