# Classificazione feature e roadmap

**Aggiornamento:** 27 novembre 2026 · [PRD](PRD_Admin_Dashboard_PoliNetwork.md) · [MVP](MVP.md).

ID storici conservati. P0: stabilizzazione interna; P1: completamento; P2: backlog.
Main indica codice integrato, non deploy verificato. Baseline e fonti nel PRD §20.

## Stato per funzionalità

| ID  | Funzionalità                 | Stato verificato                                                      | Priorità e prossimo passo                                   |
| --- | ---------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| 0   | IdP / OIDC BFF               | Main, token server-side, backend autenticato                          | P0: collaudo consumer e configurazione                      |
| 1   | RBAC / People                | Binding Auth e sincronizzazione in main                               | P0: delega, revoche, outage e setup ambiente                |
| 2   | Consensi                     | Processo definitivo da progettare                                     | P1: testi, prova, revoca e retention                        |
| 2a  | Audit comune                 | Backend#90 main; Auth#76/admin#123 aperte                             | P1 · completare vista, permessi e copertura eventi Auth     |
| 2b  | eSign                        | Main, CIE/multi-documento/OneDrive                                    | P1: firma reale e Graph; nessun ponte ricevute Soci         |
| 3   | People / Soci                | Domini separati in main                                               | P0: collaudo e completamento ciclo Soci                     |
| 4   | Overview / ricerca           | Overview e palette in main                                            | P2: ricerca trasversale e KPI                               |
| 5   | Admin / Capo                 | Incarichi Auth e Capo in sola lettura in main                         | P0: scoping reale; gestione Capo futura                     |
| 6   | Quote e ciclo Soci           | Quote main; ciclo residuo in admin#169/backend#151                    | P0 · decisione Direttivo e collaudo                         |
| 7   | Team                         | Binding, stati e Lead in main                                         | P0: verifica delega; tool team P2                           |
| 8   | Inviti / import / censimento | Inviti main, import People stralciato, seed chiuso, censimento mockup | P1 · collaudo inviti e design fase 3                        |
| 9   | Compleanni                   | Backend#130 main                                                      | P1: dati, job e recapito reale                              |
| 10  | FAQ                          | CRUD e selezione Matricole main                                       | P1: contenuti/import; editoriale avanzato P2                |
| 11  | Operatività / CMS / M365     | Main; M365 solo lettura                                               | P1: collaudo; risorse progetto backend#72 aperta            |
| 12  | Associazioni / promozioni    | CRUD interno main; portale e richieste in PR; pubblicazione manuale   | P2 · rivedere le PR e assegnare consegna Telegram (§12 PRD) |
| 13  | Eventi / PoliTamTam          | Eventi associazioni in PR; PoliTamTam backlog                         | P2 · completare revisione eventi e vista pubblica           |
| 14  | Aziende                      | Scope assente                                                         | P2: definire bisogni                                        |
| 15  | Casa                         | Backlog                                                               | P2: annunci e moderazione                                   |
| 16  | Newsletter                   | Backlog                                                               | P2: segmenti, consenso, disiscrizione                       |
| 17  | MCP admin                    | Admin#137 e MCP Auth in main                                          | P1 · configurazione e collaudo OAuth                        |
| 18  | Regolamenti                  | Editor, workflow, gestione documenti/file e bozze segrete in main     | P0 · collab, worker, GitHub e notifiche                     |
| 19  | Documenti pubblici           | Catalogo, CMS e viewer pubblico in main                               | P1 · popolare e verificare versioni approvate               |

## PR admin aperte

| PR                                                                                                                 | Prossimo passo                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [#168](https://github.com/PoliNetworkOrg/admin/pull/168), [#183](https://github.com/PoliNetworkOrg/admin/pull/183) | Portale e richieste di promozione; coordinare backend#150/#158 e web#226/#252  |
| [#169](https://github.com/PoliNetworkOrg/admin/pull/169)                                                           | Ciclo Soci; attendere la decisione Direttivo e coordinare backend#151          |
| [#152](https://github.com/PoliNetworkOrg/admin/pull/152)                                                           | Guida contributi e stack locale                                                |
| [#123](https://github.com/PoliNetworkOrg/admin/pull/123)                                                           | Vista audit sul backend già integrato. Coordinare Auth#76                      |
| [#75](https://github.com/PoliNetworkOrg/admin/pull/75)                                                             | Template email: rivalutare rispetto ai template Soci già integrati             |
| [#68](https://github.com/PoliNetworkOrg/admin/pull/68)                                                             | Questa revisione documentale                                                   |
| [#53](https://github.com/PoliNetworkOrg/admin/pull/53)                                                             | Dipendenza Better Auth storica: admin usa openid-client, verificare pertinenza |

## Dipendenze e attività residue

1. **People:** collaudare provisioning e inviti. Import CSV generale stralciato e seed #153 chiuso senza merge.
2. **Soci:** preview locale Libro Soci integrata (backend#152/admin#173). Ciclo Soci in admin#169/backend#151,
   in attesa della decisione Direttivo sulla decadenza.
3. **Regolamenti:** collaudare collab, compiler, legal, GitHub App e notifiche con il bot Telegram.
4. **Documenti:** backend#132, admin#162 e web#220 in main. Popolare contenuti approvati e collaudare il sito.
5. **Audit:** backend#90 in main. Restano Auth#76, admin#123 e verifica della copertura Auth.
6. **Risorse progetto:** backend#72 aperta; poi editor admin e sito.
7. **Associazioni:** revisionare il portale e le promozioni. Il comando bot e la pianificazione backend sono il
   lavoro residuo per la consegna automatica. [Stato e perimetro](PRD_Admin_Dashboard_PoliNetwork.md#121-richieste-di-promozione-e-consegna-telegram).
8. **Prodotto:** censimento #145, consensi/HR, lancio web e backlog esterno.

Auth#74 e #88–#90 sono in main. Restano aperte Auth#68 (override), #76 (audit), #83 (contributi) e #91
(ereditarietà ruoli built-in). Backend#118 (contributi), #72 (risorse), #55 (email) e #38 (warn) sono aperte.
Per web, elenco e verifiche nella [checklist](Checklist_Sito_Web.md).
