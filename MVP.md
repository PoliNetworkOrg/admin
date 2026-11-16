# MVP interno — stabilizzazione e completamento

**Aggiornamento:** 16 novembre 2026 · [PRD](PRD_Admin_Dashboard_PoliNetwork.md) ·
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
- [x] Catalogo Documenti backend#132; editor CMS e sito non ancora integrati.

## Gate da chiudere

- [ ] **People reale:** binding configurati, invito accettabile senza permessi dashboard, link/unlink e revoca,
      stati pending/sent/applied/refused, attore che perde delega, retry/outage, Lead e Capo fuori ambito.
- [ ] **Import:** decidere revisione/esecuzione del seed admin#153; l'import CSV generale #141/backend#103
      richiede ancora preview, commit idempotente e autorizzazioni. Non confondere i due deliverable.
- [ ] **Soci reale:** ammissione e registrazione esistenti, numero univoco, My area senza scheda People, identità Entra,
      upload/sostituzione prova, review sul file corrente, rifiuto e pagamento manuale, annualità/esenzioni ed email.
- [ ] **Ciclo Soci residuo:** cessazione/ripristino, decadenza automatica e coda/cancellazione account secondo il design.
      Il router corrente non implementa queste operazioni; l'avviso di scadenza UI non prova il job di decadenza.
- [ ] **Regolamenti reale:** collab e worker isolato, due editor, permessi per bozza/deleghe e revoche, compile/diff,
      approvazione, GitHub App, pubblicazione e destinatari notifiche. Gestione creazione/rinomina/rimozione file residua.
- [ ] **Documenti pubblici:** admin#162 e web#220 sul backend#132, categorie/versioni/PDF e contenuti approvati.

Ogni PR funzionale esegue `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` e verifica UI/permessi.
Le fixture non provano provisioning, recapito email, Graph o firma CIE. Non spuntare gate operativi senza evidenze.

## Filoni indipendenti

Audit auth#76/backend#90/admin#123; eSign con CIE reale, agent e Graph; Matricole end-to-end;
MCP admin#137 con client OAuth personale e permessi correnti. Il lancio web ha una checklist dedicata.

## Fuori dal prossimo rilascio

Censimento #145 resta mockup in attesa di design. Candidature HR, gestione gruppi dal Capo, partner/eventi,
newsletter, aziende e casa restano backlog. Le ricevute associative numerate/CIE sono escluse dal design Soci corrente.
