# Checklist lancio sito PoliNetwork

**Aggiornamento:** 27 novembre 2026.
Fonte codice: [web main 1d6daee](https://github.com/PoliNetworkOrg/web/tree/1d6daee0b34922b5294f20f628088bef6749a41c).
[PRD admin](PRD_Admin_Dashboard_PoliNetwork.md), [roadmap](PRD_Classificazione_Feature.md).

`[x]` codice integrato verificato; `[ ]` lavoro o verifica da completare. Non certifica il deploy né la qualità
dei dati di produzione. Responsabili personali sotto riportati ereditati dalla checklist, da riconfermare.
MVP.md contiene il MVP interno admin: questa è l'unica checklist per il lancio pubblico.

## Base già integrata

- [x] Correzioni rapide [web#192](https://github.com/PoliNetworkOrg/web/pull/192): link Appunti nel sito,
      contatti progetto ripuliti, Team, immagine Unisciti compressa e link Collabora corretto.
- [x] Sfondo procedurale [web#183](https://github.com/PoliNetworkOrg/web/pull/183): non è più una PR da aggiornare.
- [x] Pagine Su di noi [#188](https://github.com/PoliNetworkOrg/web/pull/188), dettaglio progetto
      [#189](https://github.com/PoliNetworkOrg/web/pull/189), Storia [#190](https://github.com/PoliNetworkOrg/web/pull/190)
      e Struttura [#186](https://github.com/PoliNetworkOrg/web/pull/186).
      L'alternativa [#191](https://github.com/PoliNetworkOrg/web/pull/191) è chiusa senza merge: non scegliere più tra due PR aperte.
- [x] Matricole legge risorse, hub Telegram e FAQ da `web.freshman`; admin #124 permette modifica e riordino
      degli slot previsti e scelta FAQ, oltre alla gestione PDF Guida.
- [x] Web #198 rende obbligatorio il token IdP di servizio per tutte le chiamate backend.

## Raffinamento visuale: integrato e residuo

- [x] Lo stack #199–#216 è confluito nel branch Home e poi in main tramite
      [#199](https://github.com/PoliNetworkOrg/web/pull/199) (130 file): Home, Storia, Su di noi, Struttura,
      Team, Unisciti, Collabora, Contatti, Progetti, Gruppi, Matricole, Associazioni, FAQ, Guide, header/footer e 404.
      #218/#219 sono state integrate sullo stesso branch prima di #199; #217 è chiusa senza merge.
      Non assegnare una nuova sequenza di merge #200–#216 sulla base della vecchia checklist.
- [x] [#221](https://github.com/PoliNetworkOrg/web/pull/221): posizione della navbar mobile.
- [x] [#222](https://github.com/PoliNetworkOrg/web/pull/222): ulteriori correzioni Su di noi/Storia/Unisciti e caroselli mobile.
- [x] [#223](https://github.com/PoliNetworkOrg/web/pull/223): audit sito, hydration/404, SEO, risorse mobile,
      accessibilità, copy e immagini.
- [x] Migrazione da Next.js a TanStack Start con [#266](https://github.com/PoliNetworkOrg/web/pull/266).
- [x] Ringraziamenti da backend con web#237, backend#157 e admin#179.
- [ ] Verificare desktop/mobile, tastiera e movimento ridotto sul risultato finale.
- [ ] Valutare [#269](https://github.com/PoliNetworkOrg/web/pull/269) per le prestazioni mobile. Easter egg #163 e gioco CFU #145 sono aperte.

#223 segnala inoltre attività esterne al codice: Email Obfuscation Cloudflare con hydration su alcune pagine,
contenuti backend mancanti/di prova e decisioni sul copy inglese. Verificare nell'ambiente target e assegnare ai
responsabili; questa revisione non modifica Cloudflare o dati di produzione.

## Contenuti e gestione admin

- [ ] **Gruppi:** verificare nomi, piattaforma e anno (es. Informatica WhatsApp 26/27), il generale Telegram assente
      dalla ricerca e i link reali. Prima distinguere errore di dati/etichette da errore della ricerca.
- [ ] **Matricole:** verificare l'hub collegato ai gruppi a database (admin#187/backend#165), i link e la modifica admin → ricaricamento web
      senza fallback statico, errori backend e FAQ selezionate. Struttura e titoli restano fissi.
- [ ] **FAQ:** popolare catalogo da gruppi/vecchio sito e definire import da file; riferimento precedente @L3ox64.
      Non confondere CRUD admin esistente con import ancora mancante.
- [ ] **Guide:** decidere quali contenuti conservare e migrare. La gestione PDF Matricole non è un CMS generico
      delle guide; #212 sistema il sito ma non completa produzione/migrazione dei testi.
- [ ] **Progetti:** rivedere elenco, archiviare contenuti vecchi e aggiungere nuovi progetti tramite le funzioni esistenti.
      Verificare riferimenti pubblici a `info@polinetwork.org` invece di contatti personali.
- [ ] **Link progetto per piattaforma:** [backend#72](https://github.com/PoliNetworkOrg/backend/pull/72) ancora aperta;
      poi pubblicare i tipi, implementare editor admin e visualizzazione web. La pagina dettaglio già integrata non basta.
- [ ] **Associazioni:** rivedere profili approvati, link multipli e accesso al portale in web#226. Filtri per corso/sede
      ed eventi sono in web#252. Dipendenze e promozioni nel [PRD](PRD_Admin_Dashboard_PoliNetwork.md#12-associazioni-partner).
- [ ] **Storia/Su di noi/Team:** dati direttivi passati, ringraziamenti, numeri coerenti e testi approvati.
      #202 condivide l'organigramma nel codice; non dedurre aggiornamento dei dati da quel refactor.
- [ ] **Home:** numeri derivati da dati attivi o contenuti editoriali verificati, senza contatori dimostrativi.
- [ ] **Appunti:** verificare tutti i link alla destinazione attuale; valutare link GitLab. Upload/archivio sul nuovo sito
      e dashboard personale sono backlog separati, da definire prima di sviluppo.

## Documenti e processi esterni

- [x] Backend#132: catalogo Documenti con categorie e storico versioni.
- [x] Integrati [admin#162](https://github.com/PoliNetworkOrg/admin/pull/162) e
      [web#220](https://github.com/PoliNetworkOrg/web/pull/220) per gestione CMS, catalogo pubblico e viewer PDF.
- [ ] Popolare statuto, regolamenti, privacy/cookie, bilanci e collegare il footer alle versioni approvate.
      Non confondere questo catalogo con l’editor collaborativo RRI già presente in admin. Donazioni/5x1000 da valutare.
- [ ] Collaudare referenti, successione e moderazione delle richieste nel portale associazioni dopo il merge.
      Il workflow per i progetti resta da definire.
- [ ] Valutare il Figma della dashboard utente (riferimento precedente Enrico) e il bisogno di login personale.
      Il token di servizio del sito non offre già quel login.

## Verifiche prima del lancio

- [ ] Inventario URL vecchi e redirect `/it/…`, `/en/…`, graduatorie, eventi; verificare destinazione e codici HTTP.
- [ ] Piano passaggio beta → dominio principale, DNS, certificati e rollback del sito.
- [ ] Google Search Console, sitemap, robots, canonical e anteprime social sui nuovi URL.
- [ ] Italiano coerente; decidere scope e responsabilità dell'eventuale versione inglese.
- [ ] Backend non disponibile: messaggi e retry comprensibili sulle pagine, senza cataloghi finti.
- [ ] Configurare client web, chiave e risorsa `backend:public:read`; senza token il backend rifiuta la richiesta.
- [ ] Verificare la compatibilità tra il pacchetto backend dei consumer e il servizio distribuito nell'ambiente target.
- [ ] Controllare con i responsabili i contenuti di produzione e gli eventuali dati di prova.
      Non eliminare righe in massa durante il controllo.
- [ ] Smoke test pubblico: ricerca gruppi, Appunti, FAQ, Matricole/PDF, progetto e link, contatti e Documenti;
      ripetere su telefono e verificare i failure del backend.

Nessuna casella operativa viene spuntata da questa revisione senza evidenza dell'ambiente di destinazione.
