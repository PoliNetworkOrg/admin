# Design — Identity Provider PoliNetwork

**Documenti collegati:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) §2.6 · [`PRD_Classificazione_Feature.md`](./PRD_Classificazione_Feature.md) #0 · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md) · [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md)
**Versione:** 2.0
**Data:** 12 ottobre 2026
**Base tecnica implementata:** repository autonoma `auth`, Better Auth e `@better-auth/oauth-provider` 1.7.2, Drizzle/Postgres.

## 0. Baseline e fonti

Questa revisione descrive il codice integrato, non certifica il deploy o il completamento della migrazione operativa. SHA e fonti per repository sono nel PRD §20. Per il contratto interservizio si segue la [RFC IdP–Telegram v3](https://github.com/PoliNetworkOrg/auth/blob/7ae7521f895c342fe33ee77264f4f9ef1531055c/docs/idp-telegram-integration-rfc-v3.md), con le successive modifiche Azure descritte nel codice dei consumer.

La proposta precedente di estendere il Better Auth del backend mantenendo OTP email, link Telegram a codice e `capability_grant` è superata. L'IdP è autonomo; admin è un consumer OIDC. Il backend conserva temporaneamente l'autenticazione e i dati legacy per la transizione.

## 1. Identità e collegamenti implementati

L'identità locale è `user.id`; gli account esterni sono identificati per issuer/subject verificati. Email uguali non fanno un merge automatico di due persone. I collegamenti possono avere indirizzi diversi.

- **Google e PoliNetwork Entra:** login e registrazione. Entra è vincolato al tenant PoliNetwork e richiede `acct: 0`: gli account guest sono rifiutati.
- **Passkey:** registrabili dopo il login e utilizzabili per gli accessi successivi. Il server impedisce di scollegare l'ultimo account Google/Entra anche se rimangono passkey o account di verifica.
- **Telegram:** collegamento opzionale nell'account tramite OIDC ufficiale, PKCE e ID token RS256; non è un login diretto. L'ID Telegram numerico è salvato in `identity_evidence` con unicità; lo username è metadato aggiornabile per visualizzazione, non una chiave di autorizzazione. Collegare Telegram non assegna alcun ruolo.
- **Student:** prova del possesso di un indirizzo `@mail.polimi.it` tramite codice email. Socio, Student, Direttivo e Telegram collegato sono fatti indipendenti.
- **Socio/Direttivo:** oggi derivano dai gruppi configurati del tenant Entra PoliNetwork; non dal pagamento della quota o da un codice di claim del registro associativo.

L'account personale gestisce collegamenti, passkey e sessioni. La directory amministrativa IdP mostra gli stati individuali e i metodi di accesso; la gestione dei ruoli ha permessi separati. Questa directory non è l'Anagrafica Soci o il Censimento Admin/Team del PRD.

## 2. Verifica Polimi implementata

Sono ammessi solo indirizzi del dominio esatto `mail.polimi.it`, non `polimi.it` e non un'allowlist di domini amministrabile.

Il codice ha sei cifre, TTL di 10 minuti, massimo cinque tentativi e cooldown di reinvio di 60 secondi su utente e destinatario. Il database salva l'HMAC del codice. La verifica riuscita crea il collegamento `polimi-email` e l'evidenza Student con durata `STUDENT_VERIFICATION_TTL_DAYS`. L'invio usa Microsoft Graph e `AZURE_EMAIL_SENDER`.

Questa verifica attesta il possesso della casella, non corso/anno, tesseramento, quota o consenso privacy. L'estensione ad altri domini resta una decisione di prodotto.

## 3. Socio: stato corrente e collegamento futuro al registro

Lo stato IdP `socio` deriva dalla membership Entra del gruppo Soci. Non prova autonomamente che la quota annuale sia pagata e non fornisce numero associativo, scadenze o storico.

Resta necessario il registro indipendente del PRD §3.1, accessibile anche senza account Microsoft 365. La proposta di claim via codice resta **da progettare e implementare**, insieme alla riconciliazione con Entra:

1. Un operatore approva l'iscrizione e genera il numero associativo.
2. Il sistema invia all'email di iscrizione un codice di claim con hash, TTL e limite tentativi.
3. La persona accede all'IdP con un metodo disponibile e dimostra il possesso del codice.
4. Il registro viene collegato al suo `user.id`, senza richiedere email PoliNetwork o Telegram.
5. L'accesso alla propria scheda, ai rinnovi e ai consensi è limitato al proprio record.

Invio automatico o manuale, TTL, re-invio a un'altra email e conflitti tra claim/Entra sono decisioni aperte. `membership_claim` e i relativi endpoint non esistono oggi. Il claim di un registro non deve essere confuso con l'ereditarietà del ruolo gestito Socio.

## 4. RBAC implementato e residuo

L'IdP salva ruoli, permessi, assegnazioni utente→ruolo, ereditarietà dei ruoli e implicazioni dei permessi. Non implementa una tabella di grant individuali con `level`, `scopeType` e `scopeValue`.

I ruoli gestiti sono `master-admin`, `socio`, `direttivo`, `student`. Master Admin è un wildcard derivato dalla configurazione di bootstrap/gruppo Entra; Socio e Direttivo sono verificati tramite Graph, con cache di autorizzazione di 60 secondi e diniego se la verifica fallisce. I ruoli personalizzati sono assegnabili con `idp:roles:assign`, separato da `idp:roles:write`. La delega non può eccedere i permessi correnti dell'operatore. Le mutazioni RBAC sono registrate atomicamente in `rbac_audit_event`, append-only.

Admin richiede `admin:access` e i permessi puntuali dei moduli; il backend li verifica indipendentemente. I ruoli Telegram legacy non vengono mappati automaticamente, e il veto globale `creator` non è riprodotto. Il catalogo iniziale non assegna i permessi Telegram ai ruoli ordinari: le assegnazioni vanno approvate e riconciliate.

**Residuo:** scope corso/team verificato sui record anche dal backend; permessi per Anagrafica Soci, rinnovi, consensi e onboarding. Il modello globale attuale non può garantire la vista Capo Admin limitata al proprio ambito.

## 5. OIDC e comunicazione fra servizi

- **polinet.cc:** login OIDC implementato, consumer autonomo; non è necessario condividere cookie.
- **admin:** Authorization Code con PKCE/state/nonce; verifica degli ID token, token mantenuti nelle sessioni Redis del BFF e bearer token verso backend. Il browser riceve dati utente e permessi, non i token. Refresh coordinato per sessione e logout sono parte del contratto BFF.
- **web:** token di servizio client credentials con `backend:public:read` per le letture server→backend. Non è ancora un login OIDC personale degli studenti sul sito; alcune ricerche gruppi restano anonime durante la transizione.
- **telegram:** token di servizio e attori Telegram isolati (`X-PN-Actor`); modalità shadow/enforce e outbox audit. Il bot non conserva refresh token personali degli admin.
- **backend:** verifica token/scope/tipo attore e permessi correnti tramite snapshot IdP, aggiornato da notifiche e polling; conserva ultimo snapshot/chiavi validi per disponibilità limitata.

Le applicazioni e le risorse OAuth sono amministrate nell'IdP, con client di servizio e interattivi, rotazione chiavi/segreti e gestione degli scope. Scope del client e permesso della persona sono controlli distinti.

## 6. Migrazione ancora da verificare operativamente

Le fasi di implementazione 0–4 della RFC hanno codice nei consumer. Non si assume concluso il provisioning o il cutover perché i commit sono integrati:

- riconciliare persone/ruoli legacy e collegamenti Telegram verificati nell'IdP;
- provisionare risorse, client e chiavi separate, e verificare i flussi nell'ambiente di destinazione;
- confrontare shadow/enforce del bot, poi effettuare il cutover coordinato;
- chiudere il percorso anonimo (`LEGACY_ANONYMOUS=deny`) e rimuovere input/API legacy secondo fase 5;
- eseguire backup, cleanup dei dati/auth legacy e hardening di rete secondo fase 6.

Il backend conserva ancora i grant legacy e `tg_grants_v2`; un grant attivo in una delle due fonti conta durante la transizione. Cleanup e migrazioni distruttive non sono attività di questa PR documentale.

## 7. Decisioni residue

1. Fonte e riconciliazione dello status associativo pagante rispetto al ruolo Socio Entra.
2. Modalità di claim del registro, invio/re-invio dei codici e gestione dei conflitti di identità.
3. Scope corso/team e catalogo dei nuovi moduli, con enforcement nel backend.
4. Primo flusso del sito pubblico che richiede login personale.
5. Eventuale estensione dei domini di verifica studente.
6. Evidenze operative del completamento del cutover e cleanup, senza dedurle dagli SHA applicativi.
