# Checklist sito PoliNetwork

Ultimo aggiornamento: 17/10/2026

`[x]` fatto · `[ ]` da fare · 🔀 PR aperta · 👤 chi se ne occupa

## Generale
- [x] Footer corretto
- [ ] Footer: collegare i link legali (privacy, cookie, termini) alla pagina Documenti — 👤
- [ ] Header: "Appunti" → https://polinetwork.org/it/materials/view/ — 🔀 [web#192](https://github.com/PoliNetworkOrg/web/pull/192) — 👤
- [ ] Sfondo animato — 🔀 [web#183](https://github.com/PoliNetworkOrg/web/pull/183) da aggiornare, ora rompe le pagine nuove — 👤
- [ ] Animazioni dei componenti (es. "mostra di più") — 👤
- [ ] Spaziature uniformi tra le sezioni — 🔀 [web#179](https://github.com/PoliNetworkOrg/web/pull/179) da aggiornare alle pagine nuove — 👤

## Home
- [ ] Sezione Appunti → https://polinetwork.org/it/materials/view/ — 🔀 [web#192](https://github.com/PoliNetworkOrg/web/pull/192) — 👤
- [ ] Numeri con counter automatico basato sui dati attivi (es. progetti) — 👤

## Gruppi (ricerca in home e /groups)
- [ ] Ripensare la nomenclatura: non si capisce piattaforma/anno (es. "Ingegneria Informatica" è il WhatsApp 26/27 ma sembra il generale). Capire se è un problema dei dati salvati o del sito — 👤
- [ ] Il gruppo Telegram generale di Ingegneria Informatica non compare nella ricerca — 👤

## Appunti
- [ ] Per ora: tutti i link "Appunti" (header, home, matricole) → https://polinetwork.org/it/materials/view/ — 🔀 [web#192](https://github.com/PoliNetworkOrg/web/pull/192) — 👤
- [ ] Da creare: caricamento e visualizzazione appunti sul nuovo sito — 👤

## Guide
- [ ] Decidere quali guide vecchie tenere e come strutturarle — 👤
- [ ] Sostituire il contenuto finto con le guide — 👤
- [ ] Admin: gestione guide (come per i gruppi) — 👤

## FAQs
- [ ] Popolare con le FAQ dei gruppi e del vecchio sito — 👤 @L3ox64
- [ ] Admin: import FAQ da file — 👤 @L3ox64

## Matricole
- [ ] Aggiornare i contenuti (card senza link, link Telegram vecchi) — 👤
- [ ] Rendere la pagina modificabile da admin (ora si carica solo il PDF della guida) — 👤

## Associazioni
- [ ] Aggiungere tutti i campi del vecchio sito (mancano Twitch e più canali Telegram) — 👤
- [ ] L'associazione invia la richiesta di aggiunta → approvazione in admin (stesso sistema dei progetti e delle segnalazioni link) — 👤
- [ ] L'associazione può richiedere modifiche ai propri dati — 👤

## Progetti
- [ ] Rivedere l'elenco: aggiungere i progetti nuovi, rimuovere quelli vecchi — 👤
- [ ] Lista: aggiornare i contatti (ci sono ancora quelli personali di Lorenzo e Tommaso) — 🔀 [web#192](https://github.com/PoliNetworkOrg/web/pull/192), tolti i contatti personali, resta info@polinetwork.org — 👤
- [ ] Pagina dettaglio /projects/… — 🔀 [web#189](https://github.com/PoliNetworkOrg/web/pull/189), manca la visualizzazione dei link per piattaforma — 👤
- [ ] Link per piattaforma (linux, mac, windows, web, ecc.) — 🔀 [backend#72](https://github.com/PoliNetworkOrg/backend/pull/72), fatto solo lato backend — 👤
- [ ] Admin: gestione dei link per piattaforma — 👤
- [ ] L'utente invia la richiesta di aggiunta progetto → approvazione in admin (stesso sistema delle associazioni) — 👤
- [ ] Chi ha proposto il progetto può richiederne modifica o rimozione — 👤
- [ ] (Secondario) Riscatto progetto: l'autore chiede "è mio" → se approvato può modificare solo quel progetto dalla dashboard. Da capire se gestirlo nei permessi admin o in auth — 👤

## Su di noi (/chi-siamo)
- [ ] Pagina — 🔀 [web#188](https://github.com/PoliNetworkOrg/web/pull/188), manca: numeri coerenti con la Storia ("100+" vs "200+" admin) — 👤

## Storia
- [ ] Titolo, freccia "Conosci le persone", card della timeline, organigramma in codice — 🔀 [web#190](https://github.com/PoliNetworkOrg/web/pull/190), copre tutto — 👤
- [ ] Dati dei direttivi passati — 👤
- [ ] Ringraziamenti completi (mancano admin e collaboratori) — 👤

## Struttura (/about)
- [ ] Pagina — 🔀 [web#186](https://github.com/PoliNetworkOrg/web/pull/186) e [web#191](https://github.com/PoliNetworkOrg/web/pull/191) fanno la stessa cosa, tenerne una — 👤
- [ ] Organigramma: stesso componente in codice della Storia — 👤

## Team
- [ ] Togliere sezione Direttivo, trafiletto Growth, team International e foto dei membri — 🔀 [web#192](https://github.com/PoliNetworkOrg/web/pull/192) — 👤

## Unisciti
- [ ] Più spazio tra le sezioni (risolto da web#179 se aggiornata) — 👤
- [ ] Comprimere l'immagine dei membri (22 MB) — 🔀 [web#192](https://github.com/PoliNetworkOrg/web/pull/192) — 👤

## Contatti
- [ ] Sistemare il link rotto "Collabora con noi" — 🔀 [web#192](https://github.com/PoliNetworkOrg/web/pull/192) — 👤

## Documenti (da creare)
- [ ] Progettare la pagina (design) con statuto, regolamenti interni, regole utenti, privacy, cookie e bilanci (valutare 5x1000 e donazioni) — 👤 Simone (designer), da progettare
- [ ] Implementare la pagina dopo il design — 👤

## Dashboard utente
- [ ] Valutare il Figma di Enrico e, se ha senso, implementarla — 👤

## SEO e lancio
- [ ] Redirect dai link del vecchio sito (/it/…, /en/…, /graduatorie, /events, ecc.) — 👤
- [ ] Passaggio da beta.polinetwork.org a polinetwork.org — 👤
- [ ] Mantenere la verifica di Google Search Console — 👤
- [ ] Anteprime social, sitemap e robots — 👤
- [ ] Sito impostato in italiano, sistemare i testi misti italiano/inglese — 👤
- [ ] Decidere se fare la versione inglese — 👤
- [ ] Gestire gli errori quando il backend è giù (ora pagine in errore o vuote) — 👤
- [ ] Controllare che il database di produzione non contenga dati di prova — 👤
