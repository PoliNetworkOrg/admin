# MVP interno — stabilizzazione e completamento

**Aggiornamento:** 27 novembre 2026 · [PRD](PRD_Admin_Dashboard_PoliNetwork.md) ·
[roadmap](PRD_Classificazione_Feature.md) · [lancio sito](Checklist_Sito_Web.md).

Il precedente obiettivo di costruire People fase 1 è implementato. Il prossimo risultato è verificarlo con i servizi
reali, completare il ciclo Soci e rendere utilizzabili Regolamenti e Documenti. Codice integrato e rilascio operativo
sono traguardi distinti: le caselle seguenti non attestano produzione.

## Codice disponibile

- [x] Cleanup e People: admin#147/#148/#149, Auth#73, backend#104/#105/#106/#109.
- [x] Registro Soci/ammissione/dati/numero: admin#158–#161, backend#126–#128.
- [x] Quote, revisione bonifici, pagamento manuale e My area: admin#163/backend#129; identità Entra Auth#86.
- [x] Email quote e compleanni backend#129/#130.
- [x] Regolamenti: admin#150/#151, backend#110–#117/#133/#134; ruoli Presidente/Segretario Auth#82.
- [x] Catalogo, CMS e viewer Documenti: backend#132, admin#162, web#220.
- [x] MCP admin #137 e preview locale Libro Soci backend#152/admin#173.

## Gate da chiudere

- [ ] **People reale:** binding configurati, invito accettabile senza permessi dashboard, link/unlink e revoca,
      stati pending/sent/applied/refused, attore che perde delega, retry/outage, Lead e Capo fuori ambito.
- [ ] **Libro Soci:** collaudare la preview locale e decidere la modalità di applicazione dei dati.
- [ ] **Soci reale:** ammissione e registrazione esistenti, numero univoco, My area senza scheda People, identità Entra,
      upload/sostituzione prova, review sul file corrente, rifiuto e pagamento manuale, annualità/esenzioni ed email.
- [ ] **Ciclo Soci residuo:** cessazione/ripristino, decadenza automatica e coda/cancellazione account secondo il design.
      In admin#169/backend#151, in attesa della decisione Direttivo sulla decadenza.
- [ ] **Regolamenti reale:** collab e worker isolato, due editor, permessi per bozza/deleghe e revoche, compile/diff,
      approvazione, GitHub App, pubblicazione e destinatari notifiche, compreso il bot Telegram.
- [ ] **Documenti pubblici:** popolare categorie e versioni approvate e verificare download e viewer PDF.

Ogni PR funzionale esegue `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` e verifica UI/permessi.
Le fixture non provano provisioning, recapito email, Graph o firma CIE. Non spuntare gate operativi senza evidenze.

## Filoni indipendenti

Audit con backend#90 integrata e Auth#76/admin#123 aperte; eSign con CIE reale, agent e Graph; Matricole end-to-end;
MCP admin#137 con client OAuth personale e permessi correnti. Il lancio web ha una checklist dedicata.

## Fuori dal prossimo rilascio

Censimento #145 resta mockup. Portale associazioni ed eventi sono in PR. La consegna Telegram automatica è da
sviluppare per il portale. Candidature HR, gestione gruppi dal Capo, newsletter, aziende e casa restano backlog. Le ricevute associative numerate/CIE sono escluse dal design Soci corrente.
