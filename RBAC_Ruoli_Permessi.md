# Ruoli e permessi — dashboard e People

**Versione:** 3.0 · **Aggiornamento:** 30 ottobre 2026.
[PRD](PRD_Admin_Dashboard_PoliNetwork.md), [People](Persone_Volontari_Soci.md),
[IdP](IdentityProvider_Design.md), [modello dati](IdentityProvider_DataModel.md).

## 1. Contratto corrente in admin main

Fonte: [`src/server/permissions.ts`](src/server/permissions.ts),
[`auth.middleware.ts`](src/server/auth.middleware.ts), [`nav.ts`](src/components/shell/nav.ts).

`admin:access` oppure `people:self` permette l'ingresso nella shell. Il secondo da solo apre La mia area
e le viste per gli incarichi sul proprio record, non la dashboard completa. La navigazione non costituisce
un controllo sufficiente: BFF e backend verificano le chiamate. Telegram collegato non conferisce ruoli.

| Permessi esatti presenti in main                                                           | Uso                                                                     |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `admin:access`                                                                             | Accesso amministrativo e letture di base                                |
| `tg:users:read`, `tg:messages:read`, `tg:audit:read`                                       | Utenti, messaggi e audit moderazione                                    |
| `tg:groups:manage`                                                                         | Gestione gruppi Telegram                                                |
| `tg:grants:read`, `tg:grants:manage`                                                       | Lettura e mutazioni grant                                               |
| `wa:groups:manage`                                                                         | Gestione gruppi WhatsApp                                                |
| `groups:labels:write`                                                                      | Etichette comuni                                                        |
| `web:content:write`, `web:reports:manage`                                                  | CMS incluso Matricole; gestione report                                  |
| `azure:members:read`, `azure:members:create`, `azure:members:write`                        | Directory, creazione socio, cambio numero                               |
| `azure:groups:read`                                                                        | Gruppi e membri in sola lettura                                         |
| `people:self`, `people:read`, `people:write`, `people:appoint`                             | Area personale, registri, scritture e nomine attuali                    |
| `people:members:read`, `people:members:write`, `people:fees:write`, `people:receipts:sign` | Prima implementazione Soci/quote/ricevute: **da rimuovere nel cleanup** |
| `esign:sign`, `esign:requests:manage`, `esign:drives:manage`                               | Firma, richieste e regole drive                                         |

`azure:groups:write` non appartiene più al catalogo della dashboard. Cambiare membership Soci concederebbe
o revocherebbe ruoli IdP; non riproporre quel controllo. Il cambio numero richiede token utente reale.
Non inferire permessi da prefissi, dal nome del ruolo o dal possesso di un permesso diverso: le eventuali
implicazioni sono risolte nell'IdP.

## 2. Auth e delega già implementata

Auth mantiene ruoli, assegnazioni, ereditarietà e implicazioni, con audit RBAC. I ruoli gestiti Master Admin,
Socio, Direttivo e Student sono distinti da quelli personalizzati; gli stati Entra/Student non dimostrano
quote pagate o incarichi People. Le assegnazioni dei ruoli personalizzati usano permessi IdP distinti dalla
modifica delle definizioni. Non ripristinare `ADMIN_ROLES`, il veto `creator` o `capability_grant`.

Il vecchio «HR sola lettura ovunque» non è una regola runtime: l'accesso deriva dal catalogo corrente.
Le nuove deleghe vanno approvate e configurate; queste tabelle non assegnano permessi a nessuno.

## 3. People fase 1 — requisiti, non ancora catalogo completo in main

Fonte: [#143](https://github.com/PoliNetworkOrg/admin/issues/143),
[auth#78](https://github.com/PoliNetworkOrg/auth/issues/78),
[backend#101](https://github.com/PoliNetworkOrg/backend/issues/101).

| Operazione                                               | Requisito futuro                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Leggere registri globali                                 | `admin:access` + `people:read`                                         |
| Creare/modificare persona, assegnare Admin o membro team | `admin:access` + `people:write`, oppure Lead per il proprio team       |
| Nominare/revocare Capo o Lead                            | `admin:access` + `people:appoint`                                      |
| La mia area / Capo sui propri admin                      | `people:self` e relazione sul record; Capo in sola lettura             |
| Inviare inviti                                           | `people:write` o Lead per membri del proprio team                      |
| Accettare invito                                         | Qualsiasi account autenticato + token valido, senza gate `people:self` |
| Link/unlink manuale                                      | `admin:access` + **nuovo `people:link`**                               |
| Associare ruolo a significato People in Auth             | **Nuovo permesso**, es. `idp:people:bind`; nome da confermare          |

Binding ammessi: `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`. Ruoli managed e ruoli con `idp:*`
non sono bindabili. Il vincolo deve comprendere ereditarietà/implicazioni e successive modifiche del ruolo.

Auth verifica sempre l'attore: niente autoassegnazione, nessuna delega oltre i propri permessi, comando atomico
ed idempotente. Il backend applica gli stessi limiti agli incarichi pending. Nell'accettazione invito l'attore
del comando è chi assegnò l'incarico, non l'invitato. Un rifiuto rimane visibile con il motivo.
Scoping Team Lead/Capo dipende dalle relazioni backend e dai controlli Auth: un campo `scopeType/scopeValue`
in una vecchia proposta non offre questa protezione. Il Capo non gestisce admin o ingressi gruppi in fase 1.

## 4. Cataloghi in evoluzione

- Cleanup: rimuovere i quattro permessi Soci/quote/ricevute da UI/BFF e poi IdP secondo #142/auth#77.
- Audit: `audit:read` è in [auth#76](https://github.com/PoliNetworkOrg/auth/pull/76), non nel catalogo admin main;
  distinto da `tg:audit:read`. Richiede backend#90/admin#123 e assegnazione esplicita ai revisori.
- Soci fase 2: namespace proprio (es. `soci:*`) da progettare; non ripristinare `members.*` o `membership.self*`
  come se fossero permessi disponibili. Il socio deriva da Entra, non da un claim People.
- Censimento fase 3, candidature, partner, eventi e newsletter: catalogo da definire con il processo.
- MCP admin #137: account personale e permessi delle stesse operazioni; nessun ruolo «agente» con poteri impliciti.
  L'MCP Auth già integrato è un servizio separato.

## 5. Accettazione dell'autorizzazione

Provare ogni scrittura con permesso assente e con accesso diretto al backend, oltre ai controlli UI.
Provare un Lead fuori team, un Capo su admin altrui, autoassegnazione, ruolo che implica Lead, attore che
perde delega tra invito e conferma e unlink con revoca. Aggiornare il catalogo condiviso e i security test
quando si aggiunge una server function. Non introdurre permessi descrittivi che nessun servizio applica.
