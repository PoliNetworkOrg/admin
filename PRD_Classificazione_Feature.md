# Classificazione feature e roadmap

**Aggiornamento:** 30 ottobre 2026 · [PRD](PRD_Admin_Dashboard_PoliNetwork.md) · [MVP](MVP.md).

Gli ID storici sono mantenuti per i riferimenti. Le vecchie stime di effort sono ritirate: contratto e scope
People sono cambiati. Priorità: **P0** stabilizzazione interna, **P1** completamento interno, **P2** backlog.
«Main» non certifica deploy; «PR» non significa approvata. Fonti e SHA nel PRD §20.

## Stato per funzionalità

| ID  | Funzionalità                 | Stato verificato                                                | Priorità e prossimo passo                                                                  |
| --- | ---------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0   | Identity Provider / OIDC BFF | Main, token server-side e Redis; backend senza fallback anonimo | P0: collaudo consumer/configurazione e ruoli reali, senza ricostruire auth                 |
| 1   | RBAC e scope                 | Globale in main; ruoli People non collegati                     | P0: Auth#78/#79, backend#101, admin#139; controllo record e delega                         |
| 2   | Consensi versionati          | Prima UI People presente, processo definitivo da progettare     | P1: definire testi, prova, revoca, retention; non ripristinare il vecchio matching         |
| 2a  | Audit amministrativo         | Audit di dominio esiste; registro unico in PR                   | P1: auth#76 → backend#90 → admin#123, verificando copertura Auth                           |
| 2b  | Firma CIE / eSign            | Main, anche firma multipla, OneDrive, drive policy              | P1: verifiche operative CIE/agent/Graph; ponte ricevute People da rimuovere nel cleanup    |
| 3   | People / Soci / censimento   | Prima versione in main (#97/#100), superata da #146             | P0: cleanup #142, poi People #143. Soci #144 e censimento #145 separati, design necessario |
| 4   | Overview e ricerca           | Overview e palette ⌘K in main                                   | P2: eventuale ricerca record trasversale e KPI dei nuovi domini                            |
| 5   | Admin e Capo Admin           | UI main con residui Telegram                                    | P0: #147 li rimuove; #139 aggiunge incarichi Auth e Capo in sola lettura                   |
| 6   | Rinnovi / quote / ricevute   | Implementazione main da disconnettere                           | P1: mockup in #147, nuovo design Entra in #144; nessun `people:fees:*` futuro              |
| 7   | Team                         | UI e viste limitate in main                                     | P0: binding e stati incarichi nella fase 1, Lead limitato al team                          |
| 8   | Onboarding / censimento      | UI precedente presente; flusso ruoli e inviti incompleto        | P0: inviti/link #140 e import CSV #141. Censimento #145 e candidature HR successivi        |
| 9   | Compleanni                   | Backlog                                                         | P2: dopo design Soci e regole dati/invio                                                   |
| 10  | FAQ                          | CRUD bilingue main, selezione Matricole main                    | P1: contenuti/import; workflow editoriale avanzato P2                                      |
| 11  | Aree operative               | Telegram/WhatsApp/CMS/M365 main                                 | P1: collaudo Matricole; risorse progetto dopo backend#72. Gruppi M365 solo lettura         |
| 12  | Partner esterni              | Solo CRUD interno associazioni                                  | P2: ownership e richieste approvate; nessuna area esterna già pronta                       |
| 13  | PoliTamTam                   | Backlog                                                         | P2: design eventi e approvazione dopo ownership partner                                    |
| 14  | Aziende                      | Scope assente                                                   | P2: definire bisogni prima di assegnare sviluppo                                           |
| 15  | Casa                         | Backlog                                                         | P2: processo annunci e moderazione                                                         |
| 16  | Newsletter                   | Backlog                                                         | P2: segmenti, consensi e disiscrizione                                                     |
| 17  | MCP admin                    | PR #137; MCP Auth già main, servizio distinto                   | P1: review, registrazione client e deploy, smoke test personale e permessi                 |

## PR admin aperte: come trattarle

| PR                                                                                                                 | Stato nel piano                          | Prossimo passo / dipendenza                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [#147](https://github.com/PoliNetworkOrg/admin/pull/147)                                                           | Cleanup #138, aperta                     | Verificare assenza chiamate rimosse e mockup espliciti; distribuire prima di backend#104                    |
| [#136](https://github.com/PoliNetworkOrg/admin/pull/136), [#132](https://github.com/PoliNetworkOrg/admin/pull/132) | Superate da #146, anche se ancora aperte | Non mergiare; recuperare solo rimozione gruppi, campi mancanti e rename team nelle nuove issue              |
| [#137](https://github.com/PoliNetworkOrg/admin/pull/137)                                                           | MCP personale                            | Client Native/Public PKCE, `ADMIN_MCP_CLIENT_ID`, deploy e prova reale; riallineare People al cleanup       |
| [#123](https://github.com/PoliNetworkOrg/admin/pull/123)                                                           | UI audit                                 | Auth#76 e backend#90; verificare permessi e copertura effettiva                                             |
| [#75](https://github.com/PoliNetworkOrg/admin/pull/75)                                                             | Gestione template email                  | Riesaminare su OIDC e contratto attuale; non completa rinnovi, newsletter o scheduler                       |
| [#68](https://github.com/PoliNetworkOrg/admin/pull/68)                                                             | Questi documenti                         | Review della nuova baseline e delle priorità                                                                |
| [#53](https://github.com/PoliNetworkOrg/admin/pull/53)                                                             | Aggiornamento Better Auth storico        | Verificare pertinenza: main admin usa `openid-client`, non Better Auth; non pianificare un merge automatico |

#95/#96/#97/#98/#100/#110/#111 sono già integrate: non assegnare più rebase o backend del vecchio contratto.
#133 rende obsoleta la gestione membership introdotta da #96.

## Dipendenze tra repository

| Filone           | Lavoro e ordine                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cleanup People   | [admin#138](https://github.com/PoliNetworkOrg/admin/issues/138) / PR #147 → [backend#100](https://github.com/PoliNetworkOrg/backend/issues/100) / [PR #104](https://github.com/PoliNetworkOrg/backend/pull/104) → [auth#77](https://github.com/PoliNetworkOrg/auth/issues/77)                                                                        |
| Ruoli People     | [auth#78](https://github.com/PoliNetworkOrg/auth/issues/78) rielabora [PR #73](https://github.com/PoliNetworkOrg/auth/pull/73), nuova review → [setup #79](https://github.com/PoliNetworkOrg/auth/issues/79) → [backend#101](https://github.com/PoliNetworkOrg/backend/issues/101) → [admin#139](https://github.com/PoliNetworkOrg/admin/issues/139) |
| Collegamenti     | [backend#102](https://github.com/PoliNetworkOrg/backend/issues/102) → [admin#140](https://github.com/PoliNetworkOrg/admin/issues/140), dopo record e ruoli                                                                                                                                                                                           |
| Import persone   | [backend#103](https://github.com/PoliNetworkOrg/backend/issues/103) → [admin#141](https://github.com/PoliNetworkOrg/admin/issues/141), dopo record e ruoli; non è import censimento                                                                                                                                                                  |
| Audit            | [auth#76](https://github.com/PoliNetworkOrg/auth/pull/76) → [backend#90](https://github.com/PoliNetworkOrg/backend/pull/90) → admin#123                                                                                                                                                                                                              |
| Risorse progetti | [backend#72](https://github.com/PoliNetworkOrg/backend/pull/72) → pacchetto tipi → editor admin e visualizzazione web                                                                                                                                                                                                                                |

[Backend#99](https://github.com/PoliNetworkOrg/backend/pull/99) è superata; riusare solo il codice ruoli richiesto
in #101. Auth#75 è stata incorporata nel branch #73, non in main: il modello utenti preliminari va eliminato
secondo #78. Le revisioni People restano sospese secondo #146 fino all'indicazione delle sottoissue.
Le PR Auth #68 (override permessi), #70 (guida servizi), #74 (controlli UI) e backend #57 (audit precedente),
#55 (email), #38 (warn) sono aperte ma non sostituiscono i contratti del piano sopra; verificare sovrapposizioni
prima di riprendere i vecchi filoni. Le PR di sole dipendenze non indicano avanzamento di prodotto.

## Cosa assegnare adesso

1. **Team dashboard:** finire #147/#138; dimostrare che mockup e shell non chiamino procedure eliminate.
2. **Team Auth:** #78 e #79, binding sicuri, delega e catalogo; rifare la review di #73 dopo il taglio di #75.
3. **Team backend:** cleanup #104 dopo dashboard; poi #101, #102 e #103 con tipi pubblicati.
4. **Team dashboard:** #139, #140, #141 dopo i rispettivi contratti. Test account senza permessi e ruoli limitati.
5. **Filoni indipendenti:** audit, collaudo eSign e Matricole, review MCP; vedere [MVP](MVP.md) per gli esiti attesi.
6. **Prodotto/Direttivo:** design Soci e censimento; contenuti e lancio web nella [checklist](Checklist_Sito_Web.md).

Non assegnare l'implementazione integrale di `docs/people/contract.md` o nuove funzioni su quote/censimento
prima del nuovo design. Nessuna data di consegna o nuovo responsabile personale è implicato da questo elenco.
