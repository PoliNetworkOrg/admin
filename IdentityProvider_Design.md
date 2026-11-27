# Design — Identity Provider e integrazione admin

**Versione:** 4.0 · **Aggiornamento:** 27 novembre 2026.
[PRD](PRD_Admin_Dashboard_PoliNetwork.md), [dati e contratti](IdentityProvider_DataModel.md),
[RBAC](RBAC_Ruoli_Permessi.md), [People](Persone_Volontari_Soci.md).
Baseline e SHA dei repository nel PRD §20; distinguere sempre main, PR e provisioning dell'ambiente.

## 1. Confini già implementati

Auth è un IdP autonomo, con Better Auth/OAuth provider e Postgres/Drizzle. Admin è un consumer OIDC,
non ospita Better Auth e non condivide cookie con Auth o backend.

- Login/registrazione Google o Entra PoliNetwork; passkey e collegamenti nell'account IdP.
- Telegram si collega tramite OIDC ufficiale, non con il vecchio codice bot, e non assegna ruoli da solo.
- Verifica studente `@mail.polimi.it` distinta da Telegram, ruolo Socio e Direttivo.
- Socio/Direttivo provengono dai gruppi Entra. La loro presenza non prova pagamento di una quota annuale.
- Directory, ruoli/permessi e applicazioni OAuth sono gestiti nell'IdP; account personale, passkey e sessioni
  si gestiscono lì, non nelle vecchie pagine di sicurezza di admin.

People riusa l’autenticazione esistente. Auth#70 integra la guida servizi; per lo stato effettivo dei consumer
confrontare la guida con codice e configurazione corrente.

## 2. Flusso admin BFF

1. `/auth/login` prepara Authorization Code con PKCE, state e nonce.
2. `/auth/callback` scambia il codice e verifica issuer, firma e nonce dell'ID token.
3. Access/refresh/ID token restano nella sessione Redis dedicata; il browser ha un cookie opaco HttpOnly.
4. `me.access` determina i permessi correnti. La shell riceve dati visualizzabili e permessi, mai token.
5. Le server functions inviano bearer token al backend, che controlla autonomamente scope/attore/permesso.
6. Refresh coordinato e POST `/auth/logout` completano il ciclo; le richieste mutanti controllano l'Origin.

L'ingresso dashboard ammette `admin:access` oppure `people:self`, che apre solo le proprie viste.
Un’assegnazione a una bozza o una delega Regolamenti ammette inoltre alla sola area Bozze tramite
`regulations.me.get`; le capacità per bozza arrivano dal backend.
Redis indisponibile dà errore, non fallback a sessioni locali. Registrazione client, chiavi, redirect esatti,
Redis e prova del login nell'ambiente target sono requisiti operativi, non conseguenze del merge.
[Handoff BFF](docs/idp-phase4c-handoff.md).

## 3. Comunicazione tra servizi: stato aggiornato

Backend main ha rimosso accesso anonimo, login legacy e campi attore forniti dal chiamante (#97).
Ogni caller presenta il token IdP; gli input non sono una fonte attendibile dell'attore.
Non configurare `LEGACY_ANONYMOUS=allow` come rollback: il percorso non esiste più nella baseline.

Web main richiede il token di servizio `backend:public:read` in tutte le chiamate (#198).
Questo non implementa login personale dei visitatori. Token personali e servizi hanno policy distinte;
act-as del bot necessita del suo scope. Snapshot/refresh della policy restano responsabilità dei servizi.

La vecchia RFC resta riferimento architetturale; non usare le sue checklist storiche per dedurre che
anonimo/grant v2/vecchio login siano ancora vie operative. Per bot e altri consumer non riesaminati qui,
verificare il rispettivo main prima di dichiarare conclusi provisioning o cleanup.

## 4. People fase 1: direzione corrente

La [roadmap #146](https://github.com/PoliNetworkOrg/admin/issues/146) sostituisce il modello dei preliminari:

- Persone senza account solo nel backend, mai utenti placeholder Auth.
- Due soli collegamenti: invito monouso accettato dopo login con qualsiasi account, oppure link manuale
  con `people:link`. Nessun matching per email, Telegram o nome, nessuna approvazione Master Admin del preliminare.
- Dopo il link Auth è fonte dei ruoli; comandi idempotenti, atomici e attribuiti all'attore autorizzato.
- Binding `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`, senza `idp:*` anche indiretti.
- Niente autoassegnazioni o deleghe oltre i permessi correnti. Auth verifica, il backend replica le regole
  sugli incarichi pending e la UI presenta attesa/applicato/rifiutato con motivo.

[Auth#73](https://github.com/PoliNetworkOrg/auth/pull/73) è in main, consumata da backend#105/#106 e admin#148/#149.
`idp:people:bind` è un permesso effettivo, non un nome provvisorio. Setup dei binding e prove ambiente restano
separati dal merge; non riaprire la progettazione degli utenti preliminari.

## 5. Soci e ruoli istituzionali

Soci è un dominio implementato separatamente da People. Ammissione e cambio numero passano da `soci.*`;
le scritture `azure.members.create`/`setAssocNumber` sono rimosse. Auth#86 espone `entraObjectId` nello snapshot
per `soci.me.*`, che usa l'account Microsoft 365 autenticato anche senza scheda People.
Il design del 9 novembre esclude ricevute associative/CIE: vedere [Soci](docs/people/soci.md).
Auth#82 introduce Presidente e Segretario, usati dal workflow Regolamenti; Auth#87 aggiunge il claim array
`polinetwork_permission_list`. Questo non sostituisce i controlli correnti backend su `me.access`.

Censimento #145, consensi e onboarding HR richiedono ancora design. Login e firma PDF non attestano il processo intero.

## 6. MCP e audit

MCP Auth è in main (PR #72), con il suo controllo `idp:mcp`. MCP admin è un servizio separato, integrato con #137:
client pubblico Native con PKCE, callback loopback, `ADMIN_MCP_CLIENT_ID`, deploy e prova reale necessari.
L'attivazione non è stata effettuata da questa revisione; firma CIE sempre con persona/agent locale.

Il registro backend è integrato con #90. Auth#76 e la vista admin#123 sono aperte. L'audit RBAC esiste, ma verificare che le
modifiche Auth siano effettivamente consultabili nel nuovo registro; non dedurre copertura dal solo middleware backend.

## 7. Prossimi controlli

- Login/refresh/logout normali con `AGENT_MODE=false`, permessi revocati e Redis indisponibile.
- Consumer con token corretto, anonimo rifiutato e nessun ripiego se il token è invalido.
- Binding e ruoli produzione secondo auth#79; ruoli IT con `idp:*` non bindabili a People.
- Invito accettato da account senza permessi su una pagina fuori dalla shell; nessun auto-grant.
- Unlink con revoca confermata, retry idempotenti, attori e outage; prove backend/Auth reali in staging.
