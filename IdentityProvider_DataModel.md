# Identity Provider PoliNetwork — schema dati e contratti

**Documenti collegati:** [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md) · [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md)
**Versione:** 1.1
**Data:** 30 settembre 2026
**A cosa serve:** i due documenti collegati dicono *cosa* costruire. Questo dice *con che forma esatta*, così chi lavora sul backend (`@polinetwork/backend`, Drizzle/Postgres) e chi lavora sulla dashboard (`admin`) partono dagli stessi campi e dagli stessi contratti, invece di doverli inventare mentre scrivono.

Le tabelle seguono lo stile già in uso nel backend (vedi `tg/link.ts`, che implementa lo stesso pattern codice+TTL per il collegamento Telegram) — non introducono un modo nuovo di lavorare, solo tre tabelle nuove più una di configurazione.

---

## 1. Tabelle nuove

### `capability_grant`

Una riga = una capacità assegnata a una persona (RBAC, §4 di `IdentityProvider_Design.md`).

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `subjectUserId` | FK → `user.id` | a chi è assegnata |
| `capability` | text | chiave del catalogo in `RBAC_Ruoli_Permessi.md` §1 (es. `members`, `members.sensitive`, `telegram.groups`, `rbac.manage`) |
| `level` | text | livello concesso, tra quelli previsti dalla riga di catalogo: `read` \| `write` \| `approve` \| `publish` \| `send` |
| `scopeType` | text, nullable | `none` \| `course` \| `team` — vuoto per capacità globali |
| `scopeValue` | text, nullable | es. id del corso o del team, coerente con `scopeType` |
| `grantedBy` | FK → `user.id` | chi ha fatto l'assegnazione |
| `grantedAt` | timestamp | |
| `revokedBy` | FK → `user.id`, nullable | |
| `revokedAt` | timestamp, nullable | una riga con `revokedAt` valorizzato è ignorata in fase di calcolo permessi, non va cancellata (storicizzazione, coerente con il vincolo di storicizzazione del PRD §3.1) |

Vincolo applicativo (non a livello DB): non può esistere più di una riga attiva (`revokedAt IS NULL`) con la stessa combinazione `subjectUserId`+`capability`+`level`+`scopeType`+`scopeValue` — evita ambiguità su quale riga è quella "vera".

Cosa **non** finisce in questa tabella:

- i **ruoli** (preset di `RBAC_Ruoli_Permessi.md` §2–§3): assegnare un ruolo crea le righe delle sue capacità, il ruolo in sé non è salvato;
- le capacità `membership.self*`: derivano dal claim del tesseramento (`membership_claim`), non da un grant, e `rbac.grantCapability` deve rifiutarle (`RBAC_Ruoli_Permessi.md` §4);
- le capacità implicite dei ruoli Telegram legacy: vengono calcolate a runtime da `authorization.getCapabilities`.

### `institutional_email_link`

Una riga = un tentativo di collegamento di un'email istituzionale (§2 di `IdentityProvider_Design.md`).

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `userId` | FK → `user.id` | |
| `email` | text | l'indirizzo istituzionale inserito |
| `domain` | text | dominio estratto da `email`, deve comparire in `institutional_email_domain` |
| `codeHash` | text | **hash del codice, mai il codice in chiaro** — stesso principio di sicurezza di qualunque OTP |
| `expiresAt` | timestamp | TTL breve, indicativamente 10 minuti |
| `attempts` | integer, default 0 | tentativi di verifica falliti, per il rate limit (§3) |
| `verifiedAt` | timestamp, nullable | |
| `createdAt` | timestamp | |

Quando `verifiedAt` viene impostato, il valore va anche copiato su `user.institutionalEmail` / `user.institutionalEmailVerifiedAt` (colonne dirette sulla riga `user`, stesso pattern di `telegramId`/`telegramUsername` già esistenti) — questa tabella resta lo storico dei tentativi, `user` resta la fonte per "qual è lo stato attuale".

### `institutional_email_domain`

Configurazione dei domini ammessi — tabella, non valore hardcoded, perché la lista può crescere.

| Campo | Tipo | Note |
|---|---|---|
| `domain` | text, PK | es. `mail.polimi.it`, `polimi.it` |
| `label` | text | es. "Politecnico di Milano", per la UI |
| `active` | boolean, default true | disattivabile senza cancellare lo storico dei collegamenti già fatti |

Righe iniziali: `mail.polimi.it`, `polimi.it` (gli unici confermati finora).

### `membership_claim`

Una riga = un codice di claim del tesseramento (§3 di `IdentityProvider_Design.md`).

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `numeroAssociativo` | FK → record Anagrafica Soci | generato al momento dell'approvazione dell'iscrizione (§3.1 del PRD) |
| `email` | text | indirizzo fornito in fase di iscrizione, destinatario del codice |
| `codeHash` | text | hash, non chiaro |
| `expiresAt` | timestamp | TTL più lungo del solito — indicativamente alcuni giorni, perché la persona potrebbe non avere ancora un'identità PoliNetwork quando il codice arriva |
| `attempts` | integer, default 0 | |
| `claimedByUserId` | FK → `user.id`, nullable | valorizzato al claim riuscito |
| `claimedAt` | timestamp, nullable | |
| `createdAt` | timestamp | |

Al claim riuscito, il record Anagrafica Soci corrispondente a `numeroAssociativo` va collegato a `claimedByUserId` (campo `userId` da aggiungere alla tabella Anagrafica Soci stessa, non qui) — è quel collegamento che dà alla persona le capacità `membership.self*` (`RBAC_Ruoli_Permessi.md` §1).

---

## 2. Contratti (endpoint / funzioni)

Stesso stile dei plugin Better Auth già presenti (`telegram.link.start` / `telegram.link.verify` in `src/lib/auth-plugins.ts`) — non un'API a parte, si aggiungono come nuove funzioni sullo stesso client di autenticazione.

| Funzione | Chi può chiamarla | Input | Output | Errori attesi |
|---|---|---|---|---|
| `identity.institutionalEmail.start` | Chiunque abbia una sessione attiva | `{ email }` | `{ expiresAt }` | dominio non in allowlist; email già verificata su un altro account |
| `identity.institutionalEmail.verify` | Chiunque abbia una sessione attiva e un tentativo pendente | `{ code }` | `{ verified: true, email }` | codice errato/scaduto; troppi tentativi (§3) |
| `identity.membershipClaim.verify` | Chiunque abbia una sessione attiva | `{ code }` | `{ verified: true, numeroAssociativo }` | codice errato/scaduto/già usato |
| `authorization.getCapabilities` | Chiunque abbia una sessione attiva | — (usa la sessione) | elenco capacità effettive (merge di `capability_grant` + ruoli Telegram legacy mappati, §4 di `IdentityProvider_Design.md` + capacità `membership.self*` se c'è un claim riuscito) | — |
| `rbac.grantCapability` | Richiede `rbac.manage` | `{ subjectUserId, capability, level, scopeType?, scopeValue? }` | riga `capability_grant` creata | permesso mancante; combinazione già attiva; capacità `self`; scope mancante su capacità che lo richiede (`capoadmin_view`, `teams`) |
| `rbac.revokeCapability` | Richiede `rbac.manage` | `{ grantId }` | conferma | permesso mancante; grant già revocato |

`identity.membershipClaim.start` **non** è una funzione chiamata da un utente: è un effetto collaterale interno del flusso di approvazione iscrizione (§3.1 del PRD) — va agganciata lì, non esposta come endpoint pubblico a sé.

Ogni chiamata che scrive (`verify`, `grantCapability`, `revokeCapability`) produce una voce nell'audit unificato (§2.2 del PRD) — questo dipende dal fatto che l'audit sia già definito; se non lo è ancora, va almeno previsto un evento generico "identity mutation" da poter arricchire dopo.

---

## 3. Sicurezza dei codici (comune alle tre tabelle a codice)

- **Mai salvare il codice in chiaro** — solo l'hash (es. stesso schema di hashing già usato da Better Auth per le proprie credenziali).
- **Un solo codice attivo per volta** per la stessa combinazione utente+risorsa: generarne uno nuovo invalida il precedente (evita confusione su "quale email ho ricevuto per ultima").
- **Rate limit sui tentativi di verifica** (campo `attempts`): bloccare dopo un numero contenuto di tentativi falliti (es. 5), non solo sul TTL — altrimenti il codice a 6 cifre è indovinabile per forza bruta entro il TTL.
- **Uso singolo**: un codice verificato con successo non deve poter essere riusato (per `membership_claim` il vincolo naturale è `claimedAt IS NULL`; per `institutional_email_link` è `verifiedAt IS NULL`).

---

## 4. Punti da verificare col team backend prima di scrivere codice

1. Dove vive esattamente la tabella Anagrafica Soci (non ancora costruita, §3 del PRD) — `membership_claim.numeroAssociativo` e il nuovo campo `userId` su quella tabella dipendono dalla sua forma finale.
2. Se l'hashing dei codici deve riusare una utility già presente in Better Auth/backend o va scritta ad hoc.
3. Il formato esatto dell'evento di audit (§2.2) — questo documento assume che esista un modo generico per scrivere "chi ha fatto cosa, quando, su cosa", ma la forma precisa non è ancora definita altrove.
4. TTL esatti (10 minuti per Politecnico, "alcuni giorni" per il claim socio sono indicativi, non vincolanti) — da confermare con chi gestisce l'invio email via Microsoft Graph, per capire se ci sono limiti di throughput/costo da considerare.
