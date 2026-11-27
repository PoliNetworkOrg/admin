# Modello dati e contratti — Auth, backend e admin

**Versione:** 4.0 · **Aggiornamento:** 27 novembre 2026.
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
Schema Auth main contiene `role.peopleBinding` e il supporto comandi People di #73; nessun utente preliminare.
Auth#86 espone `entraObjectId` nello snapshot e #87 il claim array `polinetwork_permission_list`.
Gli override di permessi ereditati sono in Auth#68, ancora aperta: non sono una proprietà verificata di main.

## 2. Backend e BFF main

- Il backend richiede token IdP: attore dal token, scope e tipo attore verificati, permessi correnti da snapshot.
  `me.access` è la fonte della dashboard. Nessun percorso anonimo o login legacy nella baseline #97.
- I grant correnti sono in `tg_grants` con soggetto IdP del grantor. Non descrivere più una convivenza
  operativa `tg_grants_v2`/legacy o chiedere nuovi `admin_id` Telegram per l'audit.
- Contenuti conservano autori `*_by_sub`; i riferimenti storici Telegram non equivalgono all'audit prima/dopo.
- People main espone `persons`, `admins`, `capos`, `teams`, `linking`, `capo`, `me`; schema relazionale,
  incarichi e comandi Auth sono in `src/db/schema/people/index.ts`. Nessun router quote/censimento sotto People.
- Soci separato espone `members`, `fees`, `me`: registro, prove bonifico, revisione e self-service.
- Regolamenti ha schema/contratto propri e collaborazione Yjs; Documenti pubblici è un catalogo CMS distinto.
- Admin usa Redis dedicato per token/sessioni e cookie opaco nel browser. Il contesto route non contiene token.
- Microsoft 365: Entra object ID per l'utente, `employeeId` per numero socio, gruppo Soci per appartenenza.
  Microsoft 365 è in sola lettura; il nuovo socio è ammesso tramite il workflow `soci.members.admit`.

La dipendenza admin/lockfile è `@polinetwork/backend` 10.8.0, con `web.freshman` presente. Versione del pacchetto,
versione dell'app backend e contratto realmente distribuito sono evidenze diverse: controllarle separatamente.

## 3. Cleanup e contratti integrati

Admin#147 e backend#104 hanno rimosso il vecchio dominio unificato. Backend#105/#106/#109 e admin#148/#149
realizzano record, incarichi, inviti, link e unlink. Non ripristinare tabelle, matching e ponte ricevute/eSign rimossi.
Solo Censimento resta mockup: Soci usa il contratto reale separato.

Auth#73 applica binding `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`, con `idp:people:bind` e scope
interno `idp:people:roles`. I comandi sono idempotenti, attribuiti all'attore e controllati per delega/autoassegnazione.
Incarichi `pending`/`sent`/`applied`/`refused`; account collegato univoco, contatti non usati per matching.
Inviti monouso con hash, scadenza e revoca; landing `/people/invite` senza gate dashboard.
Unlink revoca i ruoli prima di scollegare. Schema e wire effettivi: [contratto People](docs/people/contract.md).
L'import CSV generale People è stato stralciato e il seed admin#153 è chiuso senza merge.

## 4. Soci e Regolamenti: contratti presenti e limiti

Soci usa `soci_members`, `soci_fees`, `soci_files`, `soci_activity`, `soci_mail`, collegati all'object ID Entra.
Numeri non riutilizzabili, quota di 500 centesimi e annualità settembre–agosto; file PDF/PNG/JPEG fino a 10 MB.
Review riferita al file caricato; outbox email idempotente. `me.completeDetails` compila soltanto campi vuoti.
Il router corrente non espone ancora `members.end`/`restore`, `accounts.delete` o `lapse.preview`, benché presenti
nel [design](docs/people/soci.md). Non generare client per quei requisiti come se fossero API già distribuite.

Regolamenti usa `regulations.*`, accessi per bozza e deleghe backend, ticket monouso per il servizio collaborativo,
worker LaTeX isolato, GitHub App per emanare e outbox notifiche. Vedere [contratto](src/features/regulations/regulations.contract.ts).
Documenti pubblici: backend#132, admin#162 e web#220 in main. L'editor Regolamenti ha un suo modello.

## 5. Proposte ritirate e modelli da progettare

- Ritirati: `capability_grant`, utenti preliminari, matching/merge di record, `membership_claim` e claim del socio
  mediante codice, join gruppi Telegram come fonte degli incarichi, registro socio People indipendente da Entra.
- Soci fase 2 #144: completare fine appartenenza/decadenza/cancellazione sul design del 9 novembre; quote già integrate.
- Censimento fase 3 #145: collegato alla fase 1; uscita tramite stesso comando di revoca ruolo Auth.
- Informative, prove di consenso, retention ed export: definire policy prima del nuovo schema.
- Audit unico: backend#90 integra `common_audit_events` e `audit.list`. Auth#76 e admin#123 sono aperte.
  Non dedurre che l'audit RBAC sia già federato dal solo fatto che entrambe le tabelle esistano.

## 6. Criteri di compatibilità

Documentare ordine deploy e differenze wire in ogni PR; nessun silenziamento dei tipi per superare un disallineamento.
Testare righe fuori ambito, token mancanti, delega, revoche, attori, retry, outage e vecchio/nuovo payload nella
transizione. Agent mode usa il fake People; non dimostra schema PostgreSQL, OAuth o consegna dei comandi Auth.
