# Classificazione feature — Admin Dashboard PoliNetwork

**Documenti collegati:** [`PRD_Admin_Dashboard_PoliNetwork.md`](./PRD_Admin_Dashboard_PoliNetwork.md) · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md) · [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) · [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md)
**Versione:** 1.4
**Data:** 17 ottobre 2026

## 0. Come leggere questa tabella

Una riga per ogni sezione principale del PRD (§1–§16), con #0 per l'IdP, #2a per il registro consultabile delle modifiche amministrative e #2b per la firma digitale con CIE. #2a e #2b dettagliano parti di #2, senza duplicarne il lavoro. Le sezioni §17–§20 (Vincoli, Fuori scope, Decisioni aperte, Fonti) sono requisiti trasversali o meta-contenuti, non feature autonome, e non sono classificate.

- **Priorità** — Low / Medium / High. Criterio guida: gli **strumenti e i dati interni** (anagrafica soci, censimento admin/team, ruoli, governance, team interni) vengono prima delle aree **accessorie** o rivolte a **soggetti esterni** (associazioni partner, aziende, alloggi). Questo riflette esplicitamente l'ordine dato nello Scopo del PRD (§0).
- **Difficoltà** — scala numerica 1–5 (1 = banale, 5 = molto complessa). Tiene conto di: quante parti del sistema tocca, se richiede nuove infrastrutture (es. Identity Provider), se dipende da decisioni ancora aperte (§19 del PRD), se è un flusso multi-step con approvazioni.
- **Stato** — riferito al codice integrato in `main`, non al deploy e non alle PR aperte (queste sono nella colonna **In corso**). Le priorità e difficoltà delle righe parziali riguardano il lavoro residuo. Fonti nel PRD §20.
- **In corso** — PR aperte o bozze che toccano la riga, con il loro stato. Una bozza non è lavoro finito: vedi §3.
- **Dipende da** — altre righe di questa tabella che devono esistere prima (o in parallelo) perché la feature abbia senso.

---

## 1. Tabella di classificazione

| # | Feature (breve) | Sezione PRD | Priorità | Difficoltà (1-5) | Dipende da | Stato | Note | In corso |
|---|---|---|---|---|---|---|---|---|
| 0 | Identity Provider PoliNetwork | [§2.6 Identity Provider PoliNetwork](./PRD_Admin_Dashboard_PoliNetwork.md#26-identity-provider-polinetwork) · design dedicato: [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) · tabelle e contratti: [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md) | High | 5 | — | Parziale | IdP autonomo e consumer admin/polinet.cc implementati; web usa token di servizio. Residui: cutover/cleanup, login personale sito, collegamento registro associativo. Non estendere il Better Auth legacy. | — |
| 1 | Ruoli e gerarchia | [§1 Persone, ruoli e gerarchie](./PRD_Admin_Dashboard_PoliNetwork.md#1-persone-ruoli-e-gerarchie) | High | 4 | #0 | Parziale | Ruoli/permessi globali e gerarchie implementati in eRBACo. Residui: preset organizzativi approvati, scope corso/team e riconciliazione legacy. | — |
| 2 | Fondamenta piattaforma (resto) | [§2 Fondamenta](./PRD_Admin_Dashboard_PoliNetwork.md#2-fondamenta) | High | 4 | #0, #1 | Parziale | Controlli BFF/backend, audit RBAC e overview implementati. Residui: audit unificato, ricerca globale, consensi/firma e indicatori associativi. | [admin#97](https://github.com/PoliNetworkOrg/admin/pull/97) (bozza): la My area mostra i consensi, solo UI senza backend. |
| 2a | Registro consultabile delle modifiche amministrative | [§2.2.1 Registro consultabile](./PRD_Admin_Dashboard_PoliNetwork.md#221-registro-consultabile-delle-modifiche-a-ruoli-permessi-e-persone) | High | 3 | #0, #1; riusa l'audit esistente | Da realizzare | Vista leggibile e filtrabile di modifiche a ruoli/permessi e rimozioni, con attore, target, data e prima/dopo. Include operatori delegati non Owner; lettura separata dalla scrittura. Priorità interna, prima di #12–#15; non richiede di attendere tutte le altre fondamenta di #2. | — |
| 2b | Firma digitale con CIE (eSign) | [§2.5 Consensi e firma](./PRD_Admin_Dashboard_PoliNetwork.md#25-gestione-dei-consensi-e-firma-della-privacy-policy-in-dashboard) · tracker: [`docs/esign/TRACKER.md`](./docs/esign/TRACKER.md) | High | 4 | #0, #1 | Parziale | Firma PDF con CIE dalla dashboard (PAdES, agente locale PoliNetwork eSign), più firmatari in sequenza, più posizioni per firmatario, firma di più documenti con un PIN, PDF da OneDrive (anche più drive) con accesso per ruolo o permesso. Residui: permesso IdP `esign:drives:manage`, prova con carta reale su macOS/Windows/Linux, permessi Graph e `ESIGN_DRIVES` in produzione, code signing dell'agente, guida utente. Non è ancora la firma della privacy né dei consensi versionati (resta #2). | [admin#110](https://github.com/PoliNetworkOrg/admin/pull/110) (ricarica dati prima del toast) e [admin#111](https://github.com/PoliNetworkOrg/admin/pull/111) (memoria PDF, chiede review); [backend#77](https://github.com/PoliNetworkOrg/backend/pull/77) e [#78](https://github.com/PoliNetworkOrg/backend/pull/78) (correzioni). |
| 3 | Anagrafica soci e censimento | [§3 Anagrafica Soci e Censimento Admin/Team](./PRD_Admin_Dashboard_PoliNetwork.md#3-anagrafica-soci-e-censimento-adminteam) | High | 4 | #0, #1, #2 | Da realizzare | Registri associativi distinti da directory IdP/Microsoft 365. Lo stato Socio da Entra non certifica pagamento o rinnovo annuale. | [admin#97](https://github.com/PoliNetworkOrg/admin/pull/97) (bozza, conflitti): registro soci, persone, censimento e collegamenti come interfaccia con dati finti. **Senza procedure backend.** |
| 4 | Governance/Direttivo | [§4 Governance e Direttivo](./PRD_Admin_Dashboard_PoliNetwork.md#4-governance-e-direttivo) | Low | 1 | #3 | Nessuna area separata | Coperta dai registri e ruoli futuri; non completata solo perché esiste il ruolo IdP Direttivo. | — |
| 5 | Vista Capo Admin | [§5 Dashboard Admin e Capo Admin](./PRD_Admin_Dashboard_PoliNetwork.md#5-dashboard-admin-e-capo-admin) | High | 3 | #1, #3 | Da realizzare | Richiede scoping sui record anche nel backend; il RBAC globale non basta. | [admin#97](https://github.com/PoliNetworkOrg/admin/pull/97) (bozza): vista Capo Admin nella UI, con regole di scoping scritte in `docs/people/contract.md` ma non applicate da nessun backend. |
| 6 | Rinnovi e pagamenti soci | [§6 Gestione Soci e Rinnovi](./PRD_Admin_Dashboard_PoliNetwork.md#6-gestione-soci-e-rinnovi) | High | 4 | #3 | Da realizzare | Upload ricevuta, approvazione, generazione ricevuta e reminder richiedono il registro associativo. | [admin#100](https://github.com/PoliNetworkOrg/admin/pull/100) (bozza, sopra #97): rinnovi, ricevute numerate, firma del Presidente (fuori dashboard) e invio. Solo UI e dati finti; IBAN e dati fiscali sono segnaposto. |
| 7 | Aree team interni | [§7 Aree Team interni](./PRD_Admin_Dashboard_PoliNetwork.md#7-aree-team-interni) | Medium | 2 | #3 | Da realizzare | Struttura team e scope dedicati; nessuna area applicativa già implementata. | [admin#97](https://github.com/PoliNetworkOrg/admin/pull/97) (bozza): pagine team e vista del Team Lead, solo UI. |
| 8 | Onboarding self-service | [§8 Onboarding e Censimento Admin](./PRD_Admin_Dashboard_PoliNetwork.md#8-onboarding-e-censimento-admin---flusso-self-service-in-dashboard) | High | 5 | #0, #2, #3 | Da realizzare | Autenticazione disponibile; firma, candidature/censimento, colloqui e assegnazione organizzativa restano da costruire. | [admin#97](https://github.com/PoliNetworkOrg/admin/pull/97) (bozza): importazione censimento e «Sei tu?» al primo accesso. Firma documenti ora disponibile grazie a #2b, ma non ancora collegata. |
| 9 | Email di compleanno | [§9 Email di compleanno](./PRD_Admin_Dashboard_PoliNetwork.md#9-email-di-compleanno) | Medium | 2 | #3 | Da realizzare | Richiede data di nascita nel registro e automazione email. | — |
| 10 | FAQ pubbliche | [§10 FAQ pubbliche](./PRD_Admin_Dashboard_PoliNetwork.md#10-faq-pubbliche) | Low | 2 | — | Parziale | CRUD/categorie IT/EN, ricerca e inline editing implementati. Residui: riordino drag&drop e bozza/pubblicata; non segnare l’intero requisito come fatto. | — |
| 11 | Miglioramenti aree esistenti | [§11 Miglioramenti alle aree esistenti](./PRD_Admin_Dashboard_PoliNetwork.md#11-miglioramenti-alle-aree-esistenti) | Medium | 3 | — | Parziale | Microsoft 365 directory e membership gruppi con permessi separati implementati, più statistiche utenti Telegram. Residui: licenze/access review, salute/import gruppi, reminder grant, versioni/workflow guide. | [admin#96](https://github.com/PoliNetworkOrg/admin/pull/96) (pronta, da rivedere): vista e gestione membri dei gruppi in un solo pulsante. [admin#95](https://github.com/PoliNetworkOrg/admin/pull/95) (bozza, conflitti): cambio numero socio e indirizzo; blocca [backend#70](https://github.com/PoliNetworkOrg/backend/pull/70). |
| 12 | Area associazioni partner | [§12 Area Associazioni Partner](./PRD_Admin_Dashboard_PoliNetwork.md#12-area-associazioni-partner) | Low | 5 | #0 (Identity Provider, accesso multi-tenant) | Da realizzare | Il CRUD interno delle pagine associazioni esiste; non equivale ad accesso esterno multi-tenant, referenti/ownership e richieste approvate. | Richieste delle associazioni dal sito: voce in `Checklist_Sito_Web.md`, nessuna PR admin. |
| 13 | Eventi PoliTamTam | [§13 Eventi delle associazioni — PoliTamTam](./PRD_Admin_Dashboard_PoliNetwork.md#13-eventi-delle-associazioni--politamtam) | Low | 3 | #12 | Da realizzare | Inserimento e approvazione eventi, dopo l’area partner. | — |
| 14 | Area aziende | [§14 Area Aziende](./PRD_Admin_Dashboard_PoliNetwork.md#14-area-aziende) | Low | — | — | Da progettare | Scope ancora da definire. | — |
| 15 | Bacheca casa | [§15 Area proprietari di casa / Bacheca casa e coinquilini](./PRD_Admin_Dashboard_PoliNetwork.md#15-area-proprietari-di-casa--bacheca-casa-e-coinquilini) | Low | 3 | — | Da realizzare | Area rivolta a soggetti esterni. | — |
| 16 | Newsletter | [§16 Newsletter](./PRD_Admin_Dashboard_PoliNetwork.md#16-newsletter) | Low | 2 | #3, opz. #13 | Da realizzare | Segmentazione su registro associativo e invio newsletter. | — |

---

## 2. Lettura rapida per fase

**Fondamenta già disponibili:** IdP e OIDC admin/polinet.cc, RBAC globale, controlli per procedura, audit RBAC, overview e firma PDF con CIE (#2b). Non occorre ricostruirle per iniziare i moduli interni; prima di dichiarare conclusa la migrazione serve il collaudo operativo/cutover (#0).

**Prima fase — lavoro interno residuo (High):** riconciliazione ruoli e scoping (#1), registro consultabile delle modifiche amministrative (#2a, riusando l'audit RBAC già presente), audit/consensi (#2, con la firma già pronta in #2b), registri soci/censimento (#3), poi rinnovi (#6), vista Capo Admin (#5) e onboarding (#8). #2a viene prima delle aree associazioni, eventi esterni, aziende e alloggi (#12–#15). La ricerca globale non deve essere confusa con un prerequisito tecnico già disponibile.

**Seconda fase — consolidamento interno (Medium):** team (#7), email compleanno (#9), miglioramenti Telegram/Microsoft 365/guide (#11).

**Terza fase — accessorie ed esterne (Low):** completamento FAQ (#10), newsletter (#16), area partner (#12), eventi (#13), aziende (#14), bacheca casa (#15). Il CRUD FAQ e il CRUD interno associazioni esistenti non completano i rispettivi workflow futuri.

L'ordine mantiene la priorità sui dati e strumenti interni richiesta dal PRD §0. Le dipendenze in tabella indicano le basi necessarie, anche quando queste sono già implementate in parte.

---

## 3. Dove siamo davvero (17 ottobre 2026)

**Collo di bottiglia: il backend.** Tutta l'area Persone (#3, #5, #6, #7, parte di #8) esiste solo come interfaccia con dati finti in [admin#97](https://github.com/PoliNetworkOrg/admin/pull/97) (16k righe, bozza, conflitti con `main`) e [admin#100](https://github.com/PoliNetworkOrg/admin/pull/100) (rinnovi, impilata su #97). `@polinetwork/backend` non ha nessuna procedura `people.*`, `fees.*` o `receipts.*`: il contratto è in `docs/people/contract.md`. Finché non esiste, quelle righe restano «Da realizzare» anche se la UI si vede.

**Fatto di recente (merge in `main`):** eSign #102–#109 (firma CIE, più drive, più posizioni, più documenti con un PIN, accesso ai drive per ruolo); rilasciati backend 1.9.0 e PoliNetwork eSign v0.2.0.

| PR | Che cos'è | Stato | Prossimo passo |
|---|---|---|---|
| [#111](https://github.com/PoliNetworkOrg/admin/pull/111) | eSign: libera la memoria delle pagine PDF | Pronta, serve review | Rivedere e mergiare |
| [#110](https://github.com/PoliNetworkOrg/admin/pull/110) | eSign: ricarica i dati prima del toast | Pronta | Rivedere e mergiare |
| [#96](https://github.com/PoliNetworkOrg/admin/pull/96) | Microsoft 365: membri dei gruppi in un solo pulsante | Pronta | Rivedere e mergiare |
| [#98](https://github.com/PoliNetworkOrg/admin/pull/98) | Font DM Sans/DM Mono self-hosted | Conflitti, serve review | Rebase e review |
| [#95](https://github.com/PoliNetworkOrg/admin/pull/95) | Cambio numero socio e indirizzo nuovo socio | Bozza, conflitti | Prima [backend#70](https://github.com/PoliNetworkOrg/backend/pull/70), poi rebase |
| [#97](https://github.com/PoliNetworkOrg/admin/pull/97) | Area Persone (UI + contratto) | Bozza, conflitti | Decidere come procedere (vedi sotto) |
| [#100](https://github.com/PoliNetworkOrg/admin/pull/100) | Rinnovi e ricevute firmate | Bozza, impilata su #97 | Dopo #97 |
| backend [#77](https://github.com/PoliNetworkOrg/backend/pull/77), [#78](https://github.com/PoliNetworkOrg/backend/pull/78) | eSign: coda per turno, rifiuto firme caricate con annotazioni | Aperte | Rivedere e mergiare |
| backend [#72](https://github.com/PoliNetworkOrg/backend/pull/72) | Link per piattaforma dei progetti | Aperta | Serve al sito (Checklist) |
| backend [#71](https://github.com/PoliNetworkOrg/backend/pull/71) | Cancellazione di sessioni e record scaduti | Aperta | Rivedere |

## 4. Cosa assegnare

Ordinato per priorità. «Sbloccato» significa che si può iniziare ora.

1. **Backend Persone (#3, poi #5, #6, #7).** Sbloccato: il contratto c'è. Una persona sul backend implementa `people.*` seguendo `docs/people/contract.md`, a partire dal registro soci e dalle regole di scoping del Capo Admin. È il lavoro più grosso e blocca quasi tutta la fase 1; vale la pena dividerlo in più persone (registro/censimento, team, rinnovi).
2. **Review e merge di #97 prima di nuovo codice su Persone.** Va fatto il rebase su `main` e decisa la strategia: mergiare la UI nascosta dietro i permessi `people:*` (come previsto dalla PR) o spezzarla. Senza questa decisione #100 resta ferma.
3. **Chiudere eSign (#2b).** Sbloccato, lavoro per chi gestisce l'infrastruttura: creare il permesso IdP `esign:drives:manage`, configurare permessi Graph e `ESIGN_DRIVES`, code signing macOS/Windows, prova con CIE reale e guida utente. Poi mergiare #110, #111, backend#77/#78.
4. **Registro modifiche amministrative (#2a).** Sbloccato: riusa l'audit RBAC esistente e non dipende dall'area Persone. È un buon lavoro isolato per chi inizia.
5. **Onboarding e consensi (#8, #2).** Dopo #3; la firma ora c'è (#2b), manca il collegamento con i testi versionati.
6. **Merge delle PR piccole:** #96, #98 (rebase), #95 (dopo backend#70). Poco lavoro, chiudono righe di #11.
7. **Sito pubblico.** La `Checklist_Sito_Web.md` è un filone a parte, quasi tutto lato `web`. Lato admin servono: gestione guide, import FAQ da file (@L3ox64, vedi #10), richieste di associazioni e progetti con approvazione (#12), link per piattaforma dei progetti (backend#72) e gestione della pagina Matricole.

**Da non assegnare ora:** aziende (#14) senza scope definito, bacheca casa (#15), newsletter (#16) ed eventi (#13): dipendono dal registro soci o dall'area partner.
