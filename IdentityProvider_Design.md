# Design — Identity Provider e integrazione admin

**Versione:** 3.0 · **Aggiornamento:** 30 ottobre 2026.
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

Non serve una nuova implementazione di autenticazione per iniziare People. Il README Auth contiene ancora
introduzioni storiche sul backend provider: per lo stato dei consumer usare il loro codice attuale.

## 2. Flusso admin BFF

1. `/auth/login` prepara Authorization Code con PKCE, state e nonce.
2. `/auth/callback` scambia il codice e verifica issuer, firma e nonce dell'ID token.
3. Access/refresh/ID token restano nella sessione Redis dedicata; il browser ha un cookie opaco HttpOnly.
4. `me.access` determina i permessi correnti. La shell riceve dati visualizzabili e permessi, mai token.
5. Le server functions inviano bearer token al backend, che controlla autonomamente scope/attore/permesso.
6. Refresh coordinato e POST `/auth/logout` completano il ciclo; le richieste mutanti controllano l'Origin.

L'ingresso dashboard ammette `admin:access` oppure `people:self`, che apre solo le proprie viste.
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

[Auth#73](https://github.com/PoliNetworkOrg/auth/pull/73) è aperta e va rielaborata secondo
[auth#78](https://github.com/PoliNetworkOrg/auth/issues/78), rimuovendo #75 incorporata nel branch.
Nuova review, poi [setup #79](https://github.com/PoliNetworkOrg/auth/issues/79), quindi backend e UI.
I nomi concreti delle tabelle e dei nuovi permessi seguono il contratto rivisto, non questa vecchia proposta.

## 5. Soci: requisito separato

[Fase 2 #144](https://github.com/PoliNetworkOrg/admin/issues/144): Entra è fonte dei soci e object ID chiave
per quote/rinnovi; nessuna condivisione di record con People. Ammissione attraverso Azure esistente.
La precedente proposta di registro socio indipendente da Entra con `membership_claim` e codice IdP è ritirata.
Non aggiungere endpoint di claim per realizzare il piano attuale.

Censimento #145 segue People fase 1; consensi, firma privacy e onboarding HR richiedono ancora design di processo.
Né login né firma PDF generica attestano da soli l'intero processo associativo.

## 6. MCP e audit

MCP Auth è in main (PR #72), con il suo controllo `idp:mcp`. MCP admin è separato, ancora in #137:
client pubblico Native con PKCE, callback loopback, `ADMIN_MCP_CLIENT_ID`, deploy e prova reale necessari.
L'attivazione non è stata effettuata da questa revisione; firma CIE sempre con persona/agent locale.

Audit unificato è un filone aperto auth#76/backend#90/admin#123. L'audit RBAC esiste, ma verificare che le
modifiche Auth siano effettivamente consultabili nel nuovo registro; non dedurre copertura dal solo middleware backend.

## 7. Prossimi controlli

- Login/refresh/logout normali con `AGENT_MODE=false`, permessi revocati e Redis indisponibile.
- Consumer con token corretto, anonimo rifiutato e nessun ripiego se il token è invalido.
- Binding e ruoli produzione secondo auth#79; ruoli IT con `idp:*` non bindabili a People.
- Invito accettato da account senza permessi su una pagina fuori dalla shell; nessun auto-grant.
- Unlink con revoca confermata, retry idempotenti, attori e outage; prove backend/Auth reali in staging.
