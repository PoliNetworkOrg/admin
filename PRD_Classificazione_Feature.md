# Classificazione feature — Admin Dashboard PoliNetwork

**Documenti collegati:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md) · [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) · [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md)
**Versione:** 1.2
**Data:** 12 ottobre 2026

## 0. Come leggere questa tabella

Una riga per ogni sezione principale del PRD (§1–§16). Le sezioni §17–§20 (Vincoli, Fuori scope, Decisioni aperte, Fonti) sono requisiti trasversali o meta-contenuti, non feature autonome, e non sono classificate.

- **Priorità** — Low / Medium / High. Criterio guida: gli **strumenti e i dati interni** (anagrafica soci, censimento admin/team, ruoli, governance, team interni) vengono prima delle aree **accessorie** o rivolte a **soggetti esterni** (associazioni partner, aziende, alloggi). Questo riflette esplicitamente l'ordine dato nello Scopo del PRD (§0).
- **Difficoltà** — scala numerica 1–5 (1 = banale, 5 = molto complessa). Tiene conto di: quante parti del sistema tocca, se richiede nuove infrastrutture (es. Identity Provider), se dipende da decisioni ancora aperte (§19 del PRD), se è un flusso multi-step con approvazioni.
- **Stato** — riferito al codice integrato, non al deploy. Le priorità e difficoltà delle righe parziali riguardano il lavoro residuo. Fonti nel PRD §20.
- **Dipende da** — altre righe di questa tabella che devono esistere prima (o in parallelo) perché la feature abbia senso.

---

## 1. Tabella di classificazione

| # | Feature (breve) | Sezione PRD | Priorità | Difficoltà (1-5) | Dipende da | Stato | Note |
|---|---|---|---|---|---|---|---|
| 0 | Identity Provider PoliNetwork | [§2.6 Identity Provider PoliNetwork](./PRD_Admin_Dashboard_PoliNetwork.md#26-identity-provider-polinetwork) · design dedicato: [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) · tabelle e contratti: [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md) | High | 5 | — | Parziale | IdP autonomo e consumer admin/polinet.cc implementati; web usa token di servizio. Residui: cutover/cleanup, login personale sito, collegamento registro associativo. Non estendere il Better Auth legacy. |
| 1 | Ruoli e gerarchia | [§1 Persone, ruoli e gerarchie](./PRD_Admin_Dashboard_PoliNetwork.md#1-persone-ruoli-e-gerarchie) | High | 4 | #0 | Parziale | Ruoli/permessi globali e gerarchie implementati in eRBACo. Residui: preset organizzativi approvati, scope corso/team e riconciliazione legacy. |
| 2 | Fondamenta piattaforma (resto) | [§2 Fondamenta](./PRD_Admin_Dashboard_PoliNetwork.md#2-fondamenta) | High | 4 | #0, #1 | Parziale | Controlli BFF/backend, audit RBAC e overview implementati. Residui: audit unificato, ricerca globale, consensi/firma e indicatori associativi. |
| 3 | Anagrafica soci e censimento | [§3 Anagrafica Soci e Censimento Admin/Team](./PRD_Admin_Dashboard_PoliNetwork.md#3-anagrafica-soci-e-censimento-adminteam) | High | 4 | #0, #1, #2 | Da realizzare | Registri associativi distinti da directory IdP/Microsoft 365. Lo stato Socio da Entra non certifica pagamento o rinnovo annuale. |
| 4 | Governance/Direttivo | [§4 Governance e Direttivo](./PRD_Admin_Dashboard_PoliNetwork.md#4-governance-e-direttivo) | Low | 1 | #3 | Nessuna area separata | Coperta dai registri e ruoli futuri; non completata solo perché esiste il ruolo IdP Direttivo. |
| 5 | Vista Capo Admin | [§5 Dashboard Admin e Capo Admin](./PRD_Admin_Dashboard_PoliNetwork.md#5-dashboard-admin-e-capo-admin) | High | 3 | #1, #3 | Da realizzare | Richiede scoping sui record anche nel backend; il RBAC globale non basta. |
| 6 | Rinnovi e pagamenti soci | [§6 Gestione Soci e Rinnovi](./PRD_Admin_Dashboard_PoliNetwork.md#6-gestione-soci-e-rinnovi) | High | 4 | #3 | Da realizzare | Upload ricevuta, approvazione, generazione ricevuta e reminder richiedono il registro associativo. |
| 7 | Aree team interni | [§7 Aree Team interni](./PRD_Admin_Dashboard_PoliNetwork.md#7-aree-team-interni) | Medium | 2 | #3 | Da realizzare | Struttura team e scope dedicati; nessuna area applicativa già implementata. |
| 8 | Onboarding self-service | [§8 Onboarding e Censimento Admin](./PRD_Admin_Dashboard_PoliNetwork.md#8-onboarding-e-censimento-admin---flusso-self-service-in-dashboard) | High | 5 | #0, #2, #3 | Da realizzare | Autenticazione disponibile; firma, candidature/censimento, colloqui e assegnazione organizzativa restano da costruire. |
| 9 | Email di compleanno | [§9 Email di compleanno](./PRD_Admin_Dashboard_PoliNetwork.md#9-email-di-compleanno) | Medium | 2 | #3 | Da realizzare | Richiede data di nascita nel registro e automazione email. |
| 10 | FAQ pubbliche | [§10 FAQ pubbliche](./PRD_Admin_Dashboard_PoliNetwork.md#10-faq-pubbliche) | Low | 2 | — | Parziale | CRUD/categorie IT/EN, ricerca e inline editing implementati. Residui: riordino drag&drop e bozza/pubblicata; non segnare l’intero requisito come fatto. |
| 11 | Miglioramenti aree esistenti | [§11 Miglioramenti alle aree esistenti](./PRD_Admin_Dashboard_PoliNetwork.md#11-miglioramenti-alle-aree-esistenti) | Medium | 3 | — | Parziale | Microsoft 365 directory e membership gruppi con permessi separati implementati, più statistiche utenti Telegram. Residui: licenze/access review, salute/import gruppi, reminder grant, versioni/workflow guide. |
| 12 | Area associazioni partner | [§12 Area Associazioni Partner](./PRD_Admin_Dashboard_PoliNetwork.md#12-area-associazioni-partner) | Low | 5 | #0 (Identity Provider, accesso multi-tenant) | Da realizzare | Il CRUD interno delle pagine associazioni esiste; non equivale ad accesso esterno multi-tenant, referenti/ownership e richieste approvate. |
| 13 | Eventi PoliTamTam | [§13 Eventi delle associazioni — PoliTamTam](./PRD_Admin_Dashboard_PoliNetwork.md#13-eventi-delle-associazioni--politamtam) | Low | 3 | #12 | Da realizzare | Inserimento e approvazione eventi, dopo l’area partner. |
| 14 | Area aziende | [§14 Area Aziende](./PRD_Admin_Dashboard_PoliNetwork.md#14-area-aziende) | Low | — | — | Da progettare | Scope ancora da definire. |
| 15 | Bacheca casa | [§15 Area proprietari di casa / Bacheca casa e coinquilini](./PRD_Admin_Dashboard_PoliNetwork.md#15-area-proprietari-di-casa--bacheca-casa-e-coinquilini) | Low | 3 | — | Da realizzare | Area rivolta a soggetti esterni. |
| 16 | Newsletter | [§16 Newsletter](./PRD_Admin_Dashboard_PoliNetwork.md#16-newsletter) | Low | 2 | #3, opz. #13 | Da realizzare | Segmentazione su registro associativo e invio newsletter. |

---

## 2. Lettura rapida per fase

**Fondamenta già disponibili:** IdP e OIDC admin/polinet.cc, RBAC globale, controlli per procedura, audit RBAC e overview. Non occorre ricostruirle per iniziare i moduli interni; prima di dichiarare conclusa la migrazione serve il collaudo operativo/cutover (#0).

**Prima fase — lavoro interno residuo (High):** riconciliazione ruoli e scoping (#1), audit/consensi (#2), registri soci/censimento (#3), poi rinnovi (#6), vista Capo Admin (#5) e onboarding (#8). La ricerca globale non deve essere confusa con un prerequisito tecnico già disponibile.

**Seconda fase — consolidamento interno (Medium):** team (#7), email compleanno (#9), miglioramenti Telegram/Microsoft 365/guide (#11).

**Terza fase — accessorie ed esterne (Low):** completamento FAQ (#10), newsletter (#16), area partner (#12), eventi (#13), aziende (#14), bacheca casa (#15). Il CRUD FAQ e il CRUD interno associazioni esistenti non completano i rispettivi workflow futuri.

L'ordine mantiene la priorità sui dati e strumenti interni richiesta dal PRD §0. Le dipendenze in tabella indicano le basi necessarie, anche quando queste sono già implementate in parte.
