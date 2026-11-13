# Modello dati e contratti — Auth, backend e admin

**Versione:** 3.0 · **Aggiornamento:** 30 ottobre 2026.
[Design IdP](IdentityProvider_Design.md), [People](Persone_Volontari_Soci.md),
[RBAC](RBAC_Ruoli_Permessi.md), [fonti/SHA](PRD_Admin_Dashboard_PoliNetwork.md#20-fonti-della-revisione).

Questo documento distingue lo schema presente dai contratti in lavorazione. Non è una migrazione SQL né
un'autorizzazione a modificare dati. Non creare tabelle usando i nomi delle vecchie proposte.

## 1. Auth main

Fonte: `src/db/auth-schema.ts`, `src/db/evidence.ts`, `src/db/rbac.ts` nel repository Auth.

| Blocco                                   | Responsabilità                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Utente / account / sessione / passkey    | Identità login e provider verificati, con vincoli di ownership                          |
| `identity_evidence`                      | Evidenze per issuer/subject, ID esterni verificati, Telegram e stati                    |
| `student_verification_challenge`         | Verifica mail Polimi con hash, scadenza, tentativi e cooldown                           |
| `permission`, `permission_implication`   | Chiavi stabili e implicazioni transitive senza cicli                                    |
| `role`, `role_parent`, `role_permission` | Ruoli, ereditarietà e permessi                                                          |
| `user_role`                              | Assegnazioni manuali con attore/data; ruoli gestiti derivati da evidenze/configurazione |
| `rbac_audit_event`                       | Audit append-only con attore, operazione, target, prima/dopo e data                     |
| OAuth / snapshot / outbox                | Client e risorse, proiezioni accesso e aggiornamenti verso consumer                     |

Username/email di contatto non sono chiavi di autorizzazione. Il modello globale non contiene un sistema
`capability_grant` con livelli e scope corso/team: quella proposta non è stata adottata.
Schema Auth main non contiene i binding People della PR #73 né gli utenti preliminari di #75.
Gli override di permessi ereditati sono in Auth#68, ancora aperta: non sono una proprietà verificata di main.

## 2. Backend e BFF main

- Il backend richiede token IdP: attore dal token, scope e tipo attore verificati, permessi correnti da snapshot.
  `me.access` è la fonte della dashboard. Nessun percorso anonimo o login legacy nella baseline #97.
- I grant correnti sono in `tg_grants` con soggetto IdP del grantor. Non descrivere più una convivenza
  operativa `tg_grants_v2`/legacy o chiedere nuovi `admin_id` Telegram per l'audit.
- Contenuti conservano autori `*_by_sub`; i riferimenti storici Telegram non equivalgono all'audit prima/dopo.
- People main espone `persons`, `members`, `fees`, `receipts`, `census`, `linking`, `capo`, `me`, `teams`:
  contratto consumato tramite adapter e parsing Zod in admin. È la prima versione, da ridurre e rifare per fasi.
- Admin usa Redis dedicato per token/sessioni e cookie opaco nel browser. Il contesto route non contiene token.
- Microsoft 365: Entra object ID per l'utente, `employeeId` per numero socio, gruppo Soci per appartenenza.
  La dashboard non modifica membership dei gruppi; crea il nuovo socio tramite workflow backend fisso.

La dipendenza admin/lockfile è `@polinetwork/backend` 4.0.0, con `web.freshman` presente. Versione del pacchetto,
versione dell'app backend e contratto realmente distribuito sono evidenze diverse: controllarle separatamente.

## 3. Cleanup in PR, non ancora main

[Admin#147](https://github.com/PoliNetworkOrg/admin/pull/147) scollega soci/quote/ricevute/censimento e rimuove
matching, gruppi People e ponte eSign. [Backend#104](https://github.com/PoliNetworkOrg/backend/pull/104)
elimina i router e i campi collegati; conserva per ora record e identità People nella forma ridotta.

La migrazione proposta `0030_people_cleanup.sql` elimina file/ricevute/associazioni richieste e numero socio
People, e svuota i record di test secondo #146. Non è un backfill. Non eseguire la migrazione nell'ambito
di questa revisione. Deploy frontend prima del backend, poi rimozione dei permessi obsoleti Auth#77.

I mockup admin devono avere dati propri, separati da `people.contract.ts`, senza API o server functions.
La shell deve smettere di caricare i vecchi conteggi. Il contratto di transizione deve tollerare sia il backend
precedente sia quello ripulito fino al completamento dell'ordine di deploy.

## 4. Fase 1: contratto pianificato

Fonti: [auth#78](https://github.com/PoliNetworkOrg/auth/issues/78),
[backend#101](https://github.com/PoliNetworkOrg/backend/issues/101),
[#102](https://github.com/PoliNetworkOrg/backend/issues/102),
[#103](https://github.com/PoliNetworkOrg/backend/issues/103).

### Auth

- Campo binding del ruolo con tipi `admin`, `capo`, `team:<key>:member`, `team:<key>:lead` e vincoli.
- Directory interna dei ruoli associati e titolari; senza elenco Soci/utenti Microsoft 365 come fonte People.
- Lettura `GET /api/internal/people-roles`; comandi `POST` con scope interno `idp:people:roles`.
- Comando `{ id, actor, sub, reason, changes }`, idempotente, atomico; `sub` sempre account reale.
  Auth risolve i permessi dell'attore e rifiuta binding ambigui, auto-grant e delega insufficiente.
- Nuovo permesso di binding delegabile, nome proposto `idp:people:bind`; non creare un endpoint preliminari.

Questi contratti sono il target della rielaborazione #73; non considerarli già distribuiti.

### Backend

Record relazionali per persone, incarichi, relazione Capo, storico e inviti. Incarichi con stato
`pending`/`sent`/`applied`/`refused`, motivo e autore; account collegato univoco, contatti informativi.
Outbox comandi Auth con revisioni e retry; un record senza account non produce scritture Auth.

Inviti: hash token, 14 giorni, monouso e revocati al reinvio; nessun vincolo di uguaglianza email account/contatto.
Accettazione per account autenticato anche senza `people:self`; comandi attribuiti agli autori degli incarichi.
Link/unlink manuali con `people:link`; revoca ruoli prima di staccare l'account, cronologia e lista 30 giorni.

Import CSV: preview errori/duplicati/delega, commit idempotente e inviti opzionali. Nessuna ricerca identità
per matching durante il commit. Esportare i nuovi tipi nel pacchetto prima di aggiornare i consumer.

### Admin

Aggiornare adapter/parsing, permessi, fixture, route e test insieme al nuovo contratto. Gestire esplicitamente
pending/rifiuto senza successo ottimistico della concessione. La landing invito vive fuori dal gate dashboard.
I nomi delle nuove procedure e i dettagli wire definitivi vanno fissati nelle PR implementative; il vecchio
`docs/people/contract.md` non deve introdurre endpoint eliminati nel nuovo flusso.

## 5. Proposte ritirate e modelli da progettare

- Ritirati: `capability_grant`, utenti preliminari, matching/merge di record, `membership_claim` e claim del socio
  mediante codice, join gruppi Telegram come fonte degli incarichi, registro socio People indipendente da Entra.
- Soci fase 2 #144: quote agganciate all'object ID Entra; namespace dedicato, schema annualità/ricevute da disegnare.
- Censimento fase 3 #145: collegato alla fase 1; uscita tramite stesso comando di revoca ruolo Auth.
- Informative, prove di consenso, retention ed export: definire policy prima del nuovo schema.
- Audit unico: backend#90 propone `common_audit_events`/`audit.list`; auth#76 e admin#123 completano il filone.
  Non dedurre che l'audit RBAC sia già federato dal solo fatto che entrambe le tabelle esistano.

## 6. Criteri di compatibilità

Documentare ordine deploy e differenze wire in ogni PR; nessun silenziamento dei tipi per superare un disallineamento.
Testare righe fuori ambito, token mancanti, delega, revoche, attori, retry, outage e vecchio/nuovo payload nella
transizione. Agent mode usa il fake People; non dimostra schema PostgreSQL, OAuth o consegna dei comandi Auth.
