# Classificazione feature e roadmap

**Aggiornamento:** 16 novembre 2026 · [PRD](PRD_Admin_Dashboard_PoliNetwork.md) · [MVP](MVP.md).

ID storici conservati. P0: stabilizzazione interna; P1: completamento; P2: backlog.
Main indica codice integrato, non deploy verificato. Baseline e fonti nel PRD §20.

## Stato per funzionalità

| ID  | Funzionalità                 | Stato verificato                                                               | Priorità e prossimo passo                                             |
| --- | ---------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 0   | IdP / OIDC BFF               | Main, token server-side, backend autenticato                                   | P0: collaudo consumer e configurazione                                |
| 1   | RBAC / People                | Binding Auth e sincronizzazione in main                                        | P0: delega, revoche, outage e setup ambiente                          |
| 2   | Consensi                     | Processo definitivo da progettare                                              | P1: testi, prova, revoca e retention                                  |
| 2a  | Audit comune                 | Auth#76/backend#90/admin#123 aperte                                            | P1: completare e verificare copertura eventi Auth                     |
| 2b  | eSign                        | Main, CIE/multi-documento/OneDrive                                             | P1: firma reale e Graph; nessun ponte ricevute Soci                   |
| 3   | People / Soci                | Domini separati in main                                                        | P0: collaudo e completamento ciclo Soci                               |
| 4   | Overview / ricerca           | Overview e palette in main                                                     | P2: ricerca trasversale e KPI                                         |
| 5   | Admin / Capo                 | Incarichi Auth e Capo in sola lettura in main                                  | P0: scoping reale; gestione Capo futura                               |
| 6   | Quote                        | Revisione bonifici e My area in main                                           | P0: cessazione, ripristino, decadenza e cancellazione account residue |
| 7   | Team                         | Binding, stati e Lead in main                                                  | P0: verifica delega; tool team P2                                     |
| 8   | Inviti / import / censimento | Inviti/link main; seed #153 aperta; import generale assente; censimento mockup | P1: distinguere import e fase 3 da progettare                         |
| 9   | Compleanni                   | Backend#130 main                                                               | P1: dati, job e recapito reale                                        |
| 10  | FAQ                          | CRUD e selezione Matricole main                                                | P1: contenuti/import; editoriale avanzato P2                          |
| 11  | Operatività / CMS / M365     | Main; M365 solo lettura                                                        | P1: collaudo; risorse progetto backend#72 aperta                      |
| 12  | Partner                      | CRUD interno                                                                   | P2: ownership e richieste esterne                                     |
| 13  | PoliTamTam                   | Backlog                                                                        | P2: eventi/approvazione, distinto da altri servizi Live               |
| 14  | Aziende                      | Scope assente                                                                  | P2: definire bisogni                                                  |
| 15  | Casa                         | Backlog                                                                        | P2: annunci e moderazione                                             |
| 16  | Newsletter                   | Backlog                                                                        | P2: segmenti, consenso, disiscrizione                                 |
| 17  | MCP admin                    | #137 aperta; MCP Auth main                                                     | P1: review, client personale e collaudo                               |
| 18  | Regolamenti                  | Editor e workflow main                                                         | P0: collab/worker/GitHub/notifiche; gestione file residua             |
| 19  | Documenti pubblici           | Backend#132 main, admin#162/web#220 aperte                                     | P1: integrare consumer e popolare versioni approvate                  |

## PR admin aperte

| PR                                                       | Prossimo passo                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [#162](https://github.com/PoliNetworkOrg/admin/pull/162) | CMS Documenti sul backend integrato; coordinare web#220                                            |
| [#153](https://github.com/PoliNetworkOrg/admin/pull/153) | Revisionare seed una tantum da censimento; non è import CSV generale né esecuzione autorizzata qui |
| [#152](https://github.com/PoliNetworkOrg/admin/pull/152) | Guida contributi/stack locale                                                                      |
| [#137](https://github.com/PoliNetworkOrg/admin/pull/137) | MCP: riallineare domini e permessi, OAuth e smoke test                                             |
| [#123](https://github.com/PoliNetworkOrg/admin/pull/123) | Audit dopo Auth#76/backend#90                                                                      |
| [#75](https://github.com/PoliNetworkOrg/admin/pull/75)   | Template email: rivalutare rispetto ai template Soci già integrati                                 |
| [#68](https://github.com/PoliNetworkOrg/admin/pull/68)   | Questa revisione documentale                                                                       |
| [#53](https://github.com/PoliNetworkOrg/admin/pull/53)   | Dipendenza Better Auth storica: admin usa openid-client, verificare pertinenza                     |

## Dipendenze e attività residue

1. **People:** implementazione Auth#73 → backend#105/#106/#109 → admin#148/#149 integrata.
   Verificare provisioning e flusso reale. Import #141/backend#103 non disponibile, seed #153 separato.
2. **Soci:** registro e quote integrati. Implementare il resto del design del 9 novembre senza ricevute associative/CIE.
   Auth#86 fornisce object ID Entra; non aggiungere matching People.
3. **Regolamenti:** codice integrato, richiede collab, compiler, legal, GitHub App e notifiche configurati.
4. **Documenti:** backend#132 integrata → admin#162/web#220 aperte → contenuti approvati e test pubblico.
5. **Audit:** Auth#76 → backend#90 → admin#123; non considerare automaticamente federato l'audit RBAC Auth.
6. **Risorse progetto:** backend#72 → tipi → editor admin e sito. Catalogo Documenti è un altro filone.
7. **Prodotto:** censimento #145, consensi/HR, lancio web e backlog esterno.

Auth#70 (guida integrazione servizi) è integrata. Restano aperte Auth#68 (override), #74 (UI), #76 (audit),
#83 (contributi), #88–#91 (limite verifica studente, endpoint account, header sicurezza, ereditarietà ruoli built-in).
Non trattare queste correzioni aperte come protezioni già presenti nella baseline.
Backend#118 (contributi), #90 (audit), #72 (risorse), #57 (audit precedente), #55 (email) e #38 (warn) sono aperte;
confrontare i vecchi filoni con le implementazioni attuali prima di riprenderli. Le PR di dipendenze non attestano
avanzamento funzionale. Per web, elenco e verifiche nella [checklist](Checklist_Sito_Web.md).
