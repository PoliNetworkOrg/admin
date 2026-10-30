# MVP interno — prossimo rilascio

**Aggiornamento:** 30 ottobre 2026 · [PRD](PRD_Admin_Dashboard_PoliNetwork.md) ·
[roadmap](PRD_Classificazione_Feature.md) · [lancio sito](Checklist_Sito_Web.md).

Questo file definisce il prossimo risultato utilizzabile della dashboard. La vecchia copia parziale della
checklist web è sostituita dal rimando sopra, per evitare due elenchi di lancio divergenti.

## Obiettivo

Direttivo e Lead gestiscono Group Admin, Capo Admin e team dalla dashboard; gli account collegati ricevono
solo i ruoli Auth autorizzati. Una persona può essere censita prima del login, senza creare utenti fittizi in Auth.
La base è [fase 1 #143](https://github.com/PoliNetworkOrg/admin/issues/143), preceduta dal cleanup #142.

## Gate di rilascio

- [ ] **Cleanup frontend:** #147/#138 distribuita; soci, ricevute e censimento mostrano il banner mockup,
      dati di esempio separati e azioni disabilitate, senza loader/API. Nessun badge della shell legge procedure rimosse.
- [ ] **Cleanup backend/IdP:** backend#104 dopo dashboard; auth#77 rimuove i permessi obsoleti.
      Nessuna migrazione dei record People di test prevista da #146.
- [ ] **Auth:** #78 e setup #79, binding `admin`, `capo`, membri/Lead; nessun ruolo legato con `idp:*`;
      nuova review di #73. Catalogo e risorsa del client backend configurati nell'ambiente di destinazione.
- [ ] **Record e incarichi:** backend#101 e admin#139; creazione con nome/cognome, stati attesa/invio/applicato/rifiutato,
      motivo Auth leggibile. Una revoca in Auth si riflette nella scheda e nella vista Capo.
- [ ] **Link:** backend#102 e admin#140; invito monouso, reinvio/revoca e link manuale con `people:link`.
      Account privo di permessi accetta l'invito fuori dalla shell dashboard; email di login anche diversa.
- [ ] **Unlink:** revoca effettiva dei ruoli in Auth prima dello scollegamento; storico metodo/attore;
      collegamenti recenti consultabili per correggere errori.
- [ ] **CSV:** backend#103 e admin#141; template, anteprima errori/duplicati/deleghe, commit esplicito,
      retry senza duplicati e inviti opzionali. Nessuna scrittura all'upload.

## Prove di accettazione

1. Creare una persona senza account con un incarico consentito: rimane pending solo nel backend.
2. Accettare l'invito con un account nuovo: applicazione con attore originario dell'assegnazione;
   se nel frattempo ha perso la delega, mostrare il rifiuto senza dichiarare il ruolo assegnato.
3. Ripetere una consegna del comando: nessuna doppia assegnazione. Simulare indisponibilità Auth:
   mostrare l'attesa e non usare dati obsoleti oltre la policy backend.
4. Un Lead gestisce solo i membri del proprio team, non promuove Lead e non assegna ruoli a sé stesso.
   Un Capo legge soltanto i propri admin; accessi diretti a record altrui vengono rifiutati dal backend.
5. Scollegare con conferma e permesso: verificare revoca ruoli, cronologia e incarichi pending.
6. Provare il flusso con backend + Auth reali in staging; agent mode copre solo UI/fixture.

Ogni PR esegue `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` e verifica desktop/mobile.
Il deploy segue i gate sopra; codice in main e screenshot con fixture non bastano a spuntare questi esiti.

## Filoni che possono avanzare separatamente

- Audit auth#76/backend#90/admin#123: registro leggibile e permesso disponibile.
- eSign: configurazione drive/Graph, installazione e firma reale; conservare il flusso generico durante il cleanup.
- Matricole: modifica autorizzata da admin visibile alla successiva richiesta web; errori e FAQ protette.
- MCP #137: registrazione OAuth, review e collaudo personale dopo riallineamento al nuovo People.

## Dopo il MVP

Soci/quote su Entra (#144) e censimento admin (#145) richiedono design prima di sviluppo. Il primo non condivide
record con People; il secondo usa gli incarichi fase 1. Restano fuori candidature HR, gestione gruppi dal Capo,
partner/eventi, newsletter, aziende e casa. Nessuna di queste funzioni è necessaria per ricostruire auth o RBAC.
