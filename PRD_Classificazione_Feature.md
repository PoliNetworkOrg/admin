# Classificazione feature — Admin Dashboard PoliNetwork

**Documento collegato:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md)
**Versione:** 1.0
**Data:** 30 agosto 2026

## 0. Come leggere questa tabella

Una riga per ogni sezione principale del PRD (§1–§16). Le sezioni §17–§19 (Vincoli, Fuori scope, Decisioni aperte) sono requisiti trasversali o meta-contenuti, non feature autonome, e non sono classificate.

- **Priorità** — Low / Medium / High. Criterio guida: gli **strumenti e i dati interni** (anagrafica soci, censimento admin/team, ruoli, governance, team interni) vengono prima delle aree **accessorie** o rivolte a **soggetti esterni** (associazioni partner, aziende, alloggi). Questo riflette esplicitamente l'ordine dato nello Scopo del PRD (§0).
- **Difficoltà** — scala numerica 1–5 (1 = banale, 5 = molto complessa). Tiene conto di: quante parti del sistema tocca, se richiede nuove infrastrutture (es. Identity Provider), se dipende da decisioni ancora aperte (§19 del PRD), se è un flusso multi-step con approvazioni.
- **Dipende da** — altre righe di questa tabella che devono esistere prima (o in parallelo) perché la feature abbia senso.

---

## 1. Tabella di classificazione

| # | Feature (breve) | Sezione PRD | Priorità | Difficoltà (1-5) | Dipende da | Note |
|---|---|---|---|---|---|---|
| 0 | Identity Provider PoliNetwork | [§2.6 Identity Provider PoliNetwork](./PRD_Admin_Dashboard_PoliNetwork.md#26-identity-provider-polinetwork) · design dedicato: [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) | High | 5 | — | **Primo punto**, prima di tutto il resto. Login proprio non legato a Telegram (già email OTP/passkey); Telegram, affiliazione Politecnico (dominio `@mail.polimi.it`/`@polimi.it` via codice email) e record Socio (claim via codice) sono tre collegamenti indipendenti sulla stessa identità, nessuno implica gli altri; RBAC indipendente da Telegram; base SSO via OIDC per **sito pubblico** (primo consumer reale, usato dagli studenti), polinet.cc e futuri servizi. Sblocca #2, #8, #12 e il sito pubblico. |
| 1 | Ruoli e gerarchia | [§1 Persone, ruoli e gerarchie](./PRD_Admin_Dashboard_PoliNetwork.md#1-persone-ruoli-e-gerarchie) | High | 4 | #0 | Modello dati di base: senza questo, RBAC granulare (§2.1) e scoping Capo Admin (§5) non hanno fondamenta. |
| 2 | Fondamenta piattaforma (resto) | [§2 Fondamenta](./PRD_Admin_Dashboard_PoliNetwork.md#2-fondamenta) | High | 4 | #0, #1 | RBAC per capacità, audit unificato, ricerca globale, home operativa, consensi/firma privacy — l'Identity Provider (§2.6) è ora #0 a parte per priorità e complessità proprie. |
| 3 | Anagrafica soci e censimento | [§3 Anagrafica Soci e Censimento Admin/Team](./PRD_Admin_Dashboard_PoliNetwork.md#3-anagrafica-soci-e-censimento-adminteam) | High | 4 | #0, #1, #2 | Due registri distinti ma con permessi e audit condivisi; è il cuore dei dati interni citato nello Scopo del PRD. |
| 4 | Governance/Direttivo | [§4 Governance e Direttivo](./PRD_Admin_Dashboard_PoliNetwork.md#4-governance-e-direttivo) | Low | 1 | #3 | Esplicitamente non un'area dedicata: già coperta da §3.2 e §1.3, nessuno sviluppo aggiuntivo previsto. |
| 5 | Vista Capo Admin | [§5 Dashboard Admin e Capo Admin](./PRD_Admin_Dashboard_PoliNetwork.md#5-dashboard-admin-e-capo-admin) | High | 3 | #1, #3 | Strumento operativo interno quotidiano per una figura chiave (Capo Admin); richiede lo scoping di §2.1. |
| 6 | Rinnovi e pagamenti soci | [§6 Gestione Soci e Rinnovi](./PRD_Admin_Dashboard_PoliNetwork.md#6-gestione-soci-e-rinnovi) | High | 4 | #3 | Flusso ricorrente più frequente sull'Anagrafica Soci (upload ricevuta, approvazione, ricevuta automatica, reminder). |
| 7 | Aree team interni | [§7 Aree Team interni](./PRD_Admin_Dashboard_PoliNetwork.md#7-aree-team-interni) | Medium | 2 | #3 | Obiettivo iniziale è solo struttura/permessi, non le funzionalità specifiche di ogni team: scope volutamente ridotto per ora. |
| 8 | Onboarding self-service | [§8 Onboarding e Censimento Admin](./PRD_Admin_Dashboard_PoliNetwork.md#8-onboarding-e-censimento-admin---flusso-self-service-in-dashboard) | High | 5 | #0, #2, #3 | Flusso multi-step (auth → firma → colloquio → assegnazione ruoli) che dipende dall'Identity Provider (#0). |
| 9 | Email di compleanno | [§9 Email di compleanno](./PRD_Admin_Dashboard_PoliNetwork.md#9-email-di-compleanno) | Medium | 2 | #3 | Interna e legata all'Anagrafica Soci, ma isolata e non bloccante: buon candidato "quick win" dopo §3. |
| 10 | FAQ pubbliche | [§10 FAQ pubbliche](./PRD_Admin_Dashboard_PoliNetwork.md#10-faq-pubbliche) | Low | 2 | — | Contenuto rivolto all'esterno, CRUD semplice e indipendente dal resto. |
| 11 | Miglioramenti aree esistenti | [§11 Miglioramenti alle aree esistenti](./PRD_Admin_Dashboard_PoliNetwork.md#11-miglioramenti-alle-aree-esistenti) | Medium | 3 | — | Telegram/Azure/Guide sono già in produzione: sono incrementi su strumenti interni esistenti, non nuove fondamenta. |
| 12 | Area associazioni partner | [§12 Area Associazioni Partner](./PRD_Admin_Dashboard_PoliNetwork.md#12-area-associazioni-partner) | Low | 5 | #0 (Identity Provider, accesso multi-tenant) | Primo accesso esterno multi-tenant: gestione referenti/ownership, richieste di pubblicazione, eventuale sistema a crediti (logica non definita). |
| 13 | Eventi PoliTamTam | [§13 Eventi delle associazioni — PoliTamTam](./PRD_Admin_Dashboard_PoliNetwork.md#13-eventi-delle-associazioni--politamtam) | Low | 3 | #12 | Flusso di inserimento/approvazione eventi, ha senso solo dopo che le associazioni hanno un'area propria. |
| 14 | Area aziende | [§14 Area Aziende](./PRD_Admin_Dashboard_PoliNetwork.md#14-area-aziende) | Low | — | — | Da progettare in dettaglio: nessuna difficoltà stimabile finché non esiste uno scope. |
| 15 | Bacheca casa | [§15 Area proprietari di casa / Bacheca casa e coinquilini](./PRD_Admin_Dashboard_PoliNetwork.md#15-area-proprietari-di-casa--bacheca-casa-e-coinquilini) | Low | 3 | — | Esclusivamente rivolta a soggetti esterni, nessuna dipendenza da dati interni PoliNetwork. |
| 16 | Newsletter | [§16 Newsletter](./PRD_Admin_Dashboard_PoliNetwork.md#16-newsletter) | Low | 2 | #3, opz. #13 | Accessoria: dipende dalla segmentazione dell'Anagrafica Soci e facoltativamente dagli eventi come fonte contenuti. |

---

## 2. Lettura rapida per fase

**Prima fase — fondamenta interne (High):** #0 Identity Provider PoliNetwork → #1 Ruoli e gerarchia → #2 Fondamenta piattaforma (resto) → #3 Anagrafica soci e censimento → #6 Rinnovi e pagamenti → #5 Vista Capo Admin → #8 Onboarding self-service.

**Seconda fase — consolidamento interno (Medium):** #7 Aree team interni, #9 Email di compleanno, #11 Miglioramenti aree esistenti.

**Terza fase — accessorie ed esterne (Low):** #10 FAQ pubbliche, #16 Newsletter, #12 Area associazioni partner, #13 Eventi PoliTamTam, #14 Area aziende, #15 Bacheca casa.

Questo ordine ricalca l'indicazione dello Scopo del PRD (§0): le funzionalità interne hanno priorità sulle aree pensate per soggetti esterni.
