# Ruoli e permessi — dashboard e People

**Versione:** 4.0 · **Aggiornamento:** 27 novembre 2026.
[PRD](PRD_Admin_Dashboard_PoliNetwork.md), [People](Persone_Volontari_Soci.md),
[IdP](IdentityProvider_Design.md), [modello dati](IdentityProvider_DataModel.md).

## 1. Contratto corrente in admin main

Fonte: [`src/server/permissions.ts`](src/server/permissions.ts),
[`auth.middleware.ts`](src/server/auth.middleware.ts), [`nav.ts`](src/components/shell/nav.ts).

`admin:access` oppure `people:self` permette l'ingresso nella shell. Il secondo da solo apre La mia area
e le viste per gli incarichi sul proprio record, non la dashboard completa. La navigazione non costituisce
un controllo sufficiente: BFF e backend verificano le chiamate. Telegram collegato non conferisce ruoli.

| Permessi esatti presenti in main                               | Uso                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `admin:access`                                                 | Accesso amministrativo e letture di base             |
| `tg:users:read`, `tg:messages:read`, `tg:audit:read`           | Utenti, messaggi e audit moderazione                 |
| `tg:groups:manage`                                             | Gestione gruppi Telegram                             |
| `tg:grants:read`, `tg:grants:manage`                           | Lettura e mutazioni grant                            |
| `wa:groups:manage`                                             | Gestione gruppi WhatsApp                             |
| `groups:labels:write`                                          | Etichette comuni                                     |
| `web:content:write`, `web:reports:manage`                      | CMS incluso Matricole; gestione report               |
| `azure:members:read`                                           | Directory in sola lettura                            |
| `azure:groups:read`                                            | Gruppi e membri in sola lettura                      |
| `people:self`, `people:read`, `people:write`, `people:appoint` | Area personale, registri, scritture e nomine attuali |
| `people:link`, `soci:read`, `soci:write`                       | Link/unlink; registro, ammissione, dati e quote Soci |
| `esign:sign`, `esign:requests:manage`, `esign:drives:manage`   | Firma, richieste e regole drive                      |

`azure:groups:write` non appartiene più al catalogo della dashboard. Cambiare membership Soci concederebbe
o revocherebbe ruoli IdP; non riproporre quel controllo. Il cambio numero passa da `soci:write`; anche `azure:members:create` e `azure:members:write` sono rimossi.
Non inferire permessi da prefissi, dal nome del ruolo o dal possesso di un permesso diverso: le eventuali
implicazioni sono risolte nell'IdP.

## 2. Auth e delega già implementata

Auth mantiene ruoli, assegnazioni, ereditarietà e implicazioni, con audit RBAC. I ruoli gestiti Master Admin,
Socio, Direttivo, Presidente, Segretario e Student sono distinti da quelli personalizzati; gli stati Entra/Student non dimostrano
quote pagate o incarichi People. Le assegnazioni dei ruoli personalizzati usano permessi IdP distinti dalla
modifica delle definizioni. Non ripristinare `ADMIN_ROLES`, il veto `creator` o `capability_grant`.

Il vecchio «HR sola lettura ovunque» non è una regola runtime: l'accesso deriva dal catalogo corrente.
Le nuove deleghe vanno approvate e configurate; queste tabelle non assegnano permessi a nessuno.

## 3. People fase 1 — implementata

Fonte: [#143](https://github.com/PoliNetworkOrg/admin/issues/143),
[auth#78](https://github.com/PoliNetworkOrg/auth/issues/78),
[backend#101](https://github.com/PoliNetworkOrg/backend/issues/101).

| Operazione                                               | Controllo corrente                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Leggere registri globali                                 | `admin:access` + `people:read`                                         |
| Creare/modificare persona, assegnare Admin o membro team | `admin:access` + `people:write`, oppure Lead per il proprio team       |
| Nominare/revocare Capo o Lead                            | `admin:access` + `people:appoint`                                      |
| La mia area / Capo sui propri admin                      | `people:self` e relazione sul record; Capo in sola lettura             |
| Inviare inviti                                           | `people:write` o Lead per membri del proprio team                      |
| Accettare invito                                         | Qualsiasi account autenticato + token valido, senza gate `people:self` |
| Link/unlink manuale                                      | `admin:access` + `people:link`                                         |
| Associare ruolo a significato People in Auth             | `idp:people:bind`, introdotto da Auth#73                               |

Binding ammessi: `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`. Ruoli managed e ruoli con `idp:*`
non sono bindabili. Il vincolo deve comprendere ereditarietà/implicazioni e successive modifiche del ruolo.

Auth verifica sempre l'attore: niente autoassegnazione, nessuna delega oltre i propri permessi, comando atomico
ed idempotente. Il backend applica gli stessi limiti agli incarichi pending. Nell'accettazione invito l'attore
del comando è chi assegnò l'incarico, non l'invitato. Un rifiuto rimane visibile con il motivo.
Scoping Team Lead/Capo dipende dalle relazioni backend e dai controlli Auth: un campo `scopeType/scopeValue`
in una vecchia proposta non offre questa protezione. Il Capo non gestisce admin o ingressi gruppi in fase 1.

## 4. Cataloghi in evoluzione

- Cleanup integrato: i permessi `people:members:*`, `people:fees:write`, `people:receipts:sign` non sono nel catalogo admin.
- Audit: `audit:read` è in [auth#76](https://github.com/PoliNetworkOrg/auth/pull/76), non nel catalogo admin main;
  distinto da `tg:audit:read`. Il backend è in main (#90). Restano la vista admin#123 e l'assegnazione esplicita ai revisori.
- Soci: `soci:read`/`soci:write` attivi con `admin:access`; `soci.me.*` usa `people:self` e object ID Entra verificato.
  `soci:delete` è usato nel flusso di cancellazione in admin#169/backend#151, ancora in PR.
- Portale associazioni in admin#168/#183 e backend#150/#158: ruoli per associazione per i referenti,
  `admin:access` e `web:content:write` per gli operatori. Permesso dedicato ai crediti ancora da decidere.
- Censimento fase 3, candidature e newsletter: catalogo da definire con il processo.
- MCP admin #137: account personale e permessi delle stesse operazioni; nessun ruolo «agente» con poteri impliciti.
  L'MCP Auth già integrato è un servizio separato.

## 5. Regolamenti e accesso alla shell

`regulations:read` legge documenti e bozze; `regulations:write` crea/modifica, assegna, unisce e invia in approvazione;
`regulations:manage` registra approvazione, emana e rigenera diff; `regulations:rectify` abilita rettifiche e deleghe.
Questi quattro permessi sono nel catalogo admin main. Presidente/Segretario sono ruoli Auth#82.

Un'assegnazione viewer/commenter/editor o una delega è un dato backend, non un permesso globale IdP.
`regulations.me.get` ammette alla sola area Bozze anche senza `admin:access`/`people:self`; le azioni usano il `can`
della bozza. Non ampliare l'accesso agli altri documenti o alla dashboard per concedere questa collaborazione.

## 6. Accettazione dell'autorizzazione

Provare ogni scrittura senza permesso e con accesso diretto al backend, Lead fuori team, Capo su admin altrui,
autoassegnazione, attore che perde delega prima dell'invito, unlink e revoca. Per Soci verificare accesso soltanto
al proprio object ID, e per Regolamenti isolamento tra bozze, revoca assegnazioni e deleghe.
Agent mode non certifica i controlli reali. Aggiornare catalogo e security test con ogni nuova server function.
