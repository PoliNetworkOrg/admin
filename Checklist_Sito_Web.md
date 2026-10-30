# Checklist lancio sito PoliNetwork

**Aggiornamento:** 30 ottobre 2026.
Fonte codice: [web main 0e04231](https://github.com/PoliNetworkOrg/web/tree/0e042311a3b21e442b14ebd2d3d769d84cc55762).
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

## Raffinamento visuale aperto

La serie **#199 → #213 è ancora aperta**, impilata: review e merge dal basso, rispettando le basi.
Non segnare le correzioni come concluse perché esistono screenshot nelle PR.

| PR web                                                 | Area e prossimo controllo                                 |
| ------------------------------------------------------ | --------------------------------------------------------- |
| [#199](https://github.com/PoliNetworkOrg/web/pull/199) | Home: proporzioni, card, tipografia                       |
| [#200](https://github.com/PoliNetworkOrg/web/pull/200) | Storia: gerarchia e timeline                              |
| [#201](https://github.com/PoliNetworkOrg/web/pull/201) | Su di noi: decidere con designer v1/v2, la PR mantiene v1 |
| [#202](https://github.com/PoliNetworkOrg/web/pull/202) | Struttura: organigramma condiviso con Storia              |
| [#203](https://github.com/PoliNetworkOrg/web/pull/203) | Team: sezioni e specializzazioni                          |
| [#204](https://github.com/PoliNetworkOrg/web/pull/204) | Unisciti: ritmo e sezioni                                 |
| [#205](https://github.com/PoliNetworkOrg/web/pull/205) | Collabora e ritmo condiviso                               |
| [#206](https://github.com/PoliNetworkOrg/web/pull/206) | Contatti: griglia e layout                                |
| [#207](https://github.com/PoliNetworkOrg/web/pull/207) | Progetti: card, ricerca e fallback                        |
| [#208](https://github.com/PoliNetworkOrg/web/pull/208) | Gruppi: risultati e link                                  |
| [#209](https://github.com/PoliNetworkOrg/web/pull/209) | Matricole: layout e CardIcon responsive                   |
| [#210](https://github.com/PoliNetworkOrg/web/pull/210) | Associazioni: fallback logo e accordion                   |
| [#211](https://github.com/PoliNetworkOrg/web/pull/211) | FAQ: categoria iniziale non vuota e layout                |
| [#212](https://github.com/PoliNetworkOrg/web/pull/212) | Guide: hub e rimozione placeholder lorem                  |
| [#213](https://github.com/PoliNetworkOrg/web/pull/213) | Guida Matricola: pagina download                          |

- [ ] Confrontare [web#179](https://github.com/PoliNetworkOrg/web/pull/179), ancora aperta, con il ritmo condiviso
      della serie #199–#213. Risolvere sovrapposizione prima di integrare due sistemi di spaziatura.
- [ ] Dopo lo stack, verificare desktop/mobile, navigazione tastiera e movimento ridotto, inclusi sfondo e accordion.
      Nuove animazioni decorative non sono un gate autonomo di lancio.
- [ ] #163 (easter egg) e #145 (gioco CFU), ancora aperte, sono extra e non dipendenze del lancio.

## Contenuti e gestione admin

- [ ] **Gruppi:** verificare nomi, piattaforma e anno (es. Informatica WhatsApp 26/27), il generale Telegram assente
      dalla ricerca e i link reali. Prima distinguere errore di dati/etichette da errore della ricerca.
- [ ] **Matricole:** aggiornare card senza destinazione e link vecchi. Provare modifica admin → ricaricamento web
      senza fallback statico, errori backend e FAQ selezionate. Struttura e titoli restano fissi.
- [ ] **FAQ:** popolare catalogo da gruppi/vecchio sito e definire import da file; riferimento precedente @L3ox64.
      Non confondere CRUD admin esistente con import ancora mancante.
- [ ] **Guide:** decidere quali contenuti conservare e migrare. La gestione PDF Matricole non è un CMS generico
      delle guide; #212 sistema il sito ma non completa produzione/migrazione dei testi.
- [ ] **Progetti:** rivedere elenco, archiviare contenuti vecchi e aggiungere nuovi progetti tramite le funzioni esistenti.
      Verificare riferimenti pubblici a `info@polinetwork.org` invece di contatti personali.
- [ ] **Link progetto per piattaforma:** [backend#72](https://github.com/PoliNetworkOrg/backend/pull/72) ancora aperta;
      poi pubblicare i tipi, implementare editor admin e visualizzazione web. La pagina dettaglio già integrata non basta.
- [ ] **Associazioni:** verificare campi richiesti dal vecchio sito (Twitch, più canali Telegram). Richieste di aggiunta,
      modifica e approvazione da esterni sono un nuovo workflow, non il CRUD interno attuale.
- [ ] **Storia/Su di noi/Team:** dati direttivi passati, ringraziamenti, numeri coerenti e testi approvati.
      #202 condivide l'organigramma nel codice; non dedurre aggiornamento dei dati da quel refactor.
- [ ] **Home:** numeri derivati da dati attivi o contenuti editoriali verificati, senza contatori dimostrativi.
- [ ] **Appunti:** verificare tutti i link alla destinazione attuale; valutare link GitLab. Upload/archivio sul nuovo sito
      e dashboard personale sono backlog separati, da definire prima di sviluppo.

## Documenti e processi esterni

- [ ] **Design Documenti:** statuto, regolamenti, regole utenti, privacy/cookie e bilanci; valutare donazioni/5x1000.
      Riferimento precedente: Simone (designer), incarico da riconfermare.
- [ ] Implementare Documenti dopo il design e collegare il footer alle versioni approvate.
- [ ] Definire referenti, ownership e moderazione di richieste associazioni/progetti; non assegnare ownership
      trasferendo account personali. È backlog esterno del PRD, non gate del MVP People.
- [ ] Valutare il Figma della dashboard utente (riferimento precedente Enrico) e il bisogno di login personale.
      Il token di servizio del sito non offre già quel login.

## Verifiche prima del lancio

- [ ] Inventario URL vecchi e redirect `/it/…`, `/en/…`, graduatorie, eventi; verificare destinazione e codici HTTP.
- [ ] Piano passaggio beta → dominio principale, DNS, certificati e rollback del sito.
- [ ] Google Search Console, sitemap, robots, canonical e anteprime social sui nuovi URL.
- [ ] Italiano coerente; decidere scope e responsabilità dell'eventuale versione inglese.
- [ ] Backend non disponibile: messaggi e retry comprensibili sulle pagine, senza cataloghi finti.
- [ ] Configurare client web, chiave e risorsa `backend:public:read`; senza token il backend rifiuta la richiesta.
- [ ] Allineare tipi e versione distribuita del backend. La vecchia nota README sul pacchetto 1.4.0 non è
      prova di un blocco attuale: admin risolve 4.0.0; verificare separatamente il lockfile web.
- [ ] Controllare con i responsabili i contenuti di produzione e gli eventuali dati di prova.
      Non eliminare righe in massa durante il controllo.
- [ ] Smoke test pubblico: ricerca gruppi, Appunti, FAQ, Matricole/PDF, progetto e link, contatti e Documenti;
      ripetere su telefono e verificare i failure del backend.

Nessuna casella operativa viene spuntata da questa revisione senza evidenza dell'ambiente di destinazione.
