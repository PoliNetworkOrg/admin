# Modello dati e contratti — Identity Provider PoliNetwork

**Documenti collegati:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) §2.6 · [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md)
**Versione:** 2.0
**Data:** 12 ottobre 2026

## 0. Stato e responsabilità

Il modello implementato vive nella repository autonoma `auth`, nel proprio database Postgres/Drizzle. Questa revisione segue il codice integrato agli SHA del PRD §20; non certifica migrazioni o configurazioni di produzione.

La precedente proposta `capability_grant`, `institutional_email_link`, `institutional_email_domain` non è stata adottata. I nomi di endpoint proposti (`authorization.getCapabilities`, `rbac.grantCapability`, ecc.) non sono contratti disponibili. Non creare queste tabelle per integrare un nuovo consumer: usare OIDC/OAuth, i permessi IdP e il contratto della RFC v3.

## 1. Schema implementato in auth

Fonti: `src/db/auth-schema.ts`, `src/db/evidence.ts`, `src/db/rbac.ts`, `src/db/access-snapshot.ts`.

### 1.1 Identità ed evidenze

- **`user` e `account`:** identità locale e collegamenti provider; ownership del collegamento necessaria prima di usare un'evidenza. Matching di email non unisce utenti automaticamente.
- **`identity_evidence`:** PK `(issuer, subject)`, `provider_id`, `external_id`, lista `states`, `valid_until`, `telegram_id`, `telegram_username`, `email`. Indice univoco parziale su `telegram_id` non nullo. Username/email sono dati di visualizzazione; l'autorizzazione usa identificativi verificati, non lo username.
- **`student_verification_challenge`:** PK `user_id` con FK a `user`, `email` univoca, `code_hash`, `attempts`, `expires_at`, `last_sent_at`. Hash HMAC, TTL 10 minuti, cinque tentativi e cooldown 60 secondi. Dominio ammesso: solo `mail.polimi.it`. Alla conferma viene creato l'account `polimi-email` e la relativa evidenza Student.
- **Account/session/passkey e tabelle OAuth:** gestite dall'IdP e dal provider. Socio/Direttivo provengono dai gruppi Entra, ricontrollati per autorizzare; l'evidenza memorizzata non prolunga la freschezza della verifica.

Queste tabelle non includono un registro di quote annuali, numeri associativi o censimento organizzativo.

### 1.2 RBAC globale

| Tabella | Significato |
|---|---|
| `permission` | Chiave stabile univoca, nome/descrizione, flag managed |
| `permission_implication` | Permesso → permesso implicato; transitiva, senza cicli |
| `role` | Bundle con chiave univoca, flag managed e possibile `source_state` |
| `role_parent` | Ruolo → ruolo ereditato; transitiva, senza cicli |
| `role_permission` | Collegamenti tra ruoli e permessi |
| `user_role` | Assegnazione manuale utente→ruolo con `assigned_by`, `assigned_at`; i ruoli gestiti non sono assegnazioni manuali |
| `rbac_audit_event` | Attore, operazione, target, prima/dopo JSON, data; append-only, scritto nella transazione della mutazione |

Nel modello implementato non ci sono campi `level`, `scope_type`, `scope_value`, revoca temporale del grant o assegnazione diretta di permessi a utenti come prevedeva la proposta originaria. La rimozione di un'assegnazione viene tracciata nell'audit. Gli scope di OAuth delimitano il client, non il corso/team dei record.

I ruoli gestiti sono Master Admin (wildcard da configurazione), Socio/Direttivo (Entra), Student (email verificata). Il permesso `membership:read` non implementa da solo l'area tesseramento o i rinnovi. Implicazioni e ruoli personalizzati possono concedere accesso senza costituire prova dello stato associativo: distinguere `states`, `roles` e `permissions`.

### 1.3 Snapshot e notifiche

L'IdP pubblica snapshot versionati/proiettati per client e notifiche da outbox; il backend effettua anche polling. La relazione Telegram→identità deriva dai collegamenti verificati, non da import di vecchi codici. Per campi wire, validità per fonte e comportamento in caso di outage si segue la RFC v3 §§5–7 e il codice, evitando un secondo schema divergente in questo PRD.

## 2. Contratti implementati fra servizi

- **OIDC persone:** Authorization Code/PKCE e refresh token. I consumer verificano issuer, audience, firma e claim; `polinetwork:identity` espone stati, ruoli, permessi e Telegram ID. Per API backend l'autorità corrente viene verificata tramite snapshot, non soltanto dai claim di un vecchio ID token.
- **OAuth servizi:** client credentials con `private_key_jwt`, risorsa/audience e scope assegnati al client. Token personali e di servizio hanno tipi attore distinti.
- **Backend tRPC:** `me.access` restituisce l'accesso corrente della persona. Ogni procedura ha policy per tipo attore, scope e permesso. Il bot può usare `X-PN-Actor: telegram:<id>` solo con il relativo scope act-as.
- **Snapshot IdP:** lettura di servizio autenticata, proiezione configurata per client e notifiche interne; il backend conserva in `common_idp_state` l'ultimo snapshot/chiavi validi per un uso limitato nel tempo.
- **Dashboard BFF:** sessione in Redis, token solo sul server; le funzioni server applicano middleware e inoltrano bearer token al backend.

La compatibilità legacy senza token resta configurabile nel backend; un token invalido viene rifiutato e non ripiega sul legacy. Le nuove procedure IdP, incluso lo storico giornaliero utenti Telegram, non accettano chiamate anonime.

## 3. Dati backend implementati per la transizione

- **Audit Telegram:** attore IdP (`actor_sub`), ID Telegram opzionale, client, `basis`, eventuale review e chiave di idempotenza; le azioni automatiche/native Telegram sono distinte da quelle autorizzate per permesso IdP.
- **Grant:** `tg_grants_v2` per i caller token, con attori IdP; il backend considera anche i grant legacy fino al cleanup. Non dedurre dai nuovi campi che la vecchia tabella sia già eliminata.
- **Contenuti:** colonne `*_by_sub` per l'autore IdP; non costituiscono un audit unificato prima/dopo di ogni modifica.
- **Microsoft 365:** lettura directory, workflow dedicato di creazione e membership dei gruppi tramite Graph, con permessi separati. Non è lo schema del registro associativo PoliNetwork.

## 4. Proposta residua: registro associativo e claim

Lo schema definitivo del registro del PRD §3.1 va deciso prima delle FK. Conservare un identificativo associativo univoco, stati e annualità storicizzati, consensi versionati e collegamento opzionale all'identità IdP; nessuna dipendenza obbligatoria da account Entra/Telegram.

Una possibile futura tabella **`membership_claim`** (non implementata) conserva:

| Campo logico | Requisito proposto |
|---|---|
| ID | Identificativo univoco del claim |
| Record socio / numero associativo | Riferimento al registro futuro |
| Email destinatario | Indirizzo verificato dal processo di iscrizione |
| Hash codice | Mai codice in chiaro |
| Scadenza e tentativi | TTL e limite da definire; uso singolo e invalidazione del precedente codice |
| Identità richiedente e data claim | `user.id` dell'IdP, valorizzato solo dopo verifica e controllo conflitti |
| Creazione / attore emissione | Tracciabilità dell'emissione e dei re-invii |

Il claim deve collegare il record alla persona senza duplicare l'identità, rifiutare conflitti e concedere solo accesso ai propri dati. Emissione come effetto dell'approvazione o azione manuale, re-invio, TTL e riconciliazione con lo stato Socio Entra restano aperti. Non sono disponibili oggi endpoint `identity.membershipClaim.*`.

## 5. Modello ancora da definire

1. Schema Anagrafica Soci/Censimento, annualità, collegamento fra database e retention dei dati.
2. Scope corso/team, relazioni di responsabilità e policy dei record lato backend: il RBAC globale non li rappresenta.
3. Consensi/firme e testo versionato, audit amministrativo comune oltre al solo RBAC/moderazione.
4. Catalogo IdP dei nuovi moduli: sostituire le chiavi descrittive della roadmap con permessi esatti condivisi tra UI e backend.
5. Modalità sicura di claim e merge ownership-verified, che non esiste nel semplice collegamento account corrente.
6. Conferma operativa delle fasi 5–6: backup e rimozione delle tabelle legacy restano separati da questa revisione documentale.
