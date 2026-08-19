# Admin Dashboard Associazione

**Documento di specifica funzionale per il Team IT**  
**Versione:** 0.2  
**Data:** 20 agosto 2026  
**Stato:** Bozza per revisione

## Scopo del documento

Questo documento raccoglie le funzionalità attualmente previste per l'Admin Dashboard dell'associazione, distinguendo tra funzionalità prioritarie e funzionalità secondarie.

L'obiettivo generale è concentrare nella dashboard il maggior numero possibile di processi oggi distribuiti tra form, fogli Excel, email e operazioni manuali, mantenendo però ogni area sufficientemente modulare da poter essere sviluppata e ampliata nel tempo.

# Feature prioritarie

## 1. Area Associazioni Partner

L'area dedicata alle associazioni partner è una delle funzionalità prioritarie della piattaforma.

Ogni associazione partner deve avere un proprio accesso alla dashboard e poter gestire da un'unica area le interazioni principali con PoliNetwork.

### 1.1 Accesso e gestione degli account

La soluzione deve essere pensata per gestire in modo ordinato e scalabile decine di associazioni diverse.

Come soluzione di riferimento, PoliNetwork può creare e gestire direttamente un indirizzo email dedicato `@polinetwork.org` per ciascuna associazione partner, da utilizzare come identità per l'accesso alla dashboard.

Resta da definire con il Team IT il modello tecnico definitivo di autenticazione e gestione degli account, tenendo conto almeno di:

- creazione e disattivazione degli account;
- recupero delle credenziali;
- eventuale cambio dei referenti dell'associazione;
- possibilità futura di avere più referenti per la stessa associazione;
- gestione centralizzata degli accessi da parte di PoliNetwork.

### 1.2 Richieste di pubblicazione nei gruppi

Le associazioni partner devono poter inviare richieste di pubblicazione di messaggi nei gruppi WhatsApp e/o Telegram gestiti da PoliNetwork.

Per ogni richiesta devono essere disponibili almeno:

- contenuto del messaggio;
- gruppo o insieme di gruppi destinatari;
- eventuali allegati o link;
- data della richiesta;
- stato della richiesta;
- storico delle richieste precedenti.

Se viene mantenuto un sistema a crediti, l'associazione deve inoltre poter visualizzare:

- crediti disponibili;
- crediti utilizzati;
- data dell'eventuale rinnovo o ricarica.

La logica precisa dei crediti resta da definire.

### 1.3 Gestione della pagina pubblica dell'associazione

Ogni associazione deve avere una propria pagina pubblica sul sito PoliNetwork.

Dalla dashboard l'associazione deve poter richiedere modifiche ai dati mostrati pubblicamente, tra cui:

- nome e informazioni principali;
- descrizione;
- logo;
- sito web;
- link Instagram;
- link LinkedIn;
- altri link social;
- eventuali contatti o altre informazioni pubbliche previste dalla pagina.

Le modifiche non devono necessariamente essere pubblicate direttamente: la dashboard deve supportare un flusso di richiesta e approvazione da parte di PoliNetwork, così da mantenere il controllo sui contenuti presenti sul sito.

### 1.4 Eventi delle associazioni — nuovo PoliTamTam

La gestione degli eventi delle associazioni è una feature prioritaria.

Le associazioni partner devono poter inserire direttamente dalla dashboard gli eventi da mostrare nella pagina dedicata agli eventi delle associazioni sul sito PoliNetwork.

Questa sezione rappresenta l'evoluzione del vecchio concetto di **PoliTamTam**: un punto unico in cui raccogliere e mostrare in modo ordinato gli eventi delle associazioni.

Per ogni evento devono essere previsti almeno:

- titolo;
- associazione organizzatrice;
- descrizione;
- data e orario;
- luogo oppure link online;
- link di iscrizione, se presente;
- immagine o locandina, se prevista;
- stato dell'evento;
- eventuale data di scadenza o rimozione automatica dalla pagina.

Il flusso di pubblicazione deve essere definito con il Team IT. In particolare, va deciso se gli eventi vengano pubblicati immediatamente oppure sottoposti prima ad approvazione da parte di PoliNetwork.

## 2. Aree Team

Ogni team interno deve avere una propria area dedicata all'interno della dashboard.

Le aree previste sono:

- **Team IT**;
- **Team Design & Social**;
- **Team International**;
- **Team HR**;
- **Team Events & Partnerships**.

La struttura deve essere modulare: ogni team deve avere uno spazio indipendente, con permessi dedicati e la possibilità di aggiungere in seguito strumenti specifici senza dover riprogettare l'intera dashboard.

Le funzionalità specifiche di ciascun team verranno definite separatamente insieme ai rispettivi responsabili. In questa fase è sufficiente prevedere correttamente struttura, ruoli, accessi e separazione delle aree.

## 3. Dashboard Admin e Capo Admin

La dashboard deve permettere ai responsabili degli admin di visualizzare e gestire le informazioni relative agli admin di propria competenza.

### 3.1 Vista Capo Admin

Un Capo Admin deve poter visualizzare gli admin del proprio corso di studi e filtrare rapidamente le informazioni disponibili.

Per ogni admin devono essere disponibili almeno:

- nome;
- cognome;
- anno di corso;
- data di ingresso in PoliNetwork;
- indicazione se è rappresentante o meno;
- altre associazioni di cui fa parte;
- numero di telefono;
- username o contatto Telegram;
- collegamento rapido per contattarlo tramite WhatsApp o Telegram.

### 3.2 Filtri e ricerca

Devono essere disponibili almeno:

- ricerca per nome e cognome;
- filtro per anno;
- filtro per rappresentanza;
- filtro per appartenenza ad altre associazioni.

### 3.3 Link dei gruppi

Il Capo Admin deve avere una sezione dedicata contenente i link ai gruppi WhatsApp e Telegram di propria competenza.

La gestione dei permessi deve garantire che ciascun Capo Admin possa vedere esclusivamente i dati e i gruppi relativi al proprio ambito.

## 4. Gestione Soci e Rinnovi

La dashboard deve centralizzare anche la gestione dello stato associativo dei soci.

### 4.1 Rinnovo automatico via email

Poco prima della scadenza dell'iscrizione, il socio deve ricevere automaticamente una mail che gli ricorda di rinnovare.

La mail deve contenere le informazioni necessarie per completare il rinnovo secondo il processo associativo definito.

Non è quindi necessario che il pagamento venga effettuato direttamente dalla dashboard nella prima versione.

### 4.2 Vista Direttivo sullo stato dei soci

Il Direttivo deve poter visualizzare lo stato del rinnovo di ciascun socio e distinguere chiaramente almeno tra:

- rinnovo da verificare;
- pagamento effettuato;
- pagamento non ancora effettuato.

Per ogni socio il Direttivo deve poter eseguire almeno due azioni:

**Segna come pagato**  
Aggiorna lo stato del socio e invia automaticamente una mail di conferma al socio interessato.

**Invia reminder**  
Invia una nuova mail di promemoria al socio che non ha ancora completato il rinnovo.

La dashboard deve mantenere uno storico minimo delle azioni effettuate, in modo da sapere quando è stato inviato un reminder e quando un rinnovo è stato confermato.

### 4.3 Informazioni utili sul socio

Dove utile, la dashboard può inoltre mostrare:

- data di ingresso in PoliNetwork;
- anzianità nell'associazione;
- ruoli ricoperti;
- team di appartenenza;
- eventuale corso di studi;
- stato associativo corrente.

## 5. Email automatiche di compleanno

Nel giorno del compleanno, i soci devono ricevere automaticamente una mail di auguri da parte di PoliNetwork.

La funzionalità riguarda esclusivamente i soci e utilizza esclusivamente l'email: non è prevista, in questa fase, l'integrazione con Telegram per gli auguri.

Il provider e il sistema tecnico utilizzato per l'invio automatico delle email devono essere definiti con il Team IT.

## 6. Onboarding nuovi Admin

Il processo attuale di onboarding degli admin è troppo frammentato e comprende passaggi distribuiti tra form, email, colloqui, fogli Excel e operazioni manuali.

L'obiettivo della nuova dashboard è portare **il maggior numero possibile di passaggi direttamente all'interno della piattaforma**, riducendo gli strumenti esterni e usando la dashboard come punto centrale del processo.

Il flusso definitivo deve ancora essere progettato nel dettaglio.

Come principio generale, la soluzione futura dovrebbe cercare di centralizzare almeno:

- gestione delle candidature;
- stato della candidatura;
- gestione del colloquio;
- raccolta dei dati necessari;
- approvazione del nuovo admin;
- creazione/attivazione del profilo;
- assegnazione del corso, dei ruoli e delle competenze;
- passaggi successivi necessari all'ingresso operativo dell'admin.

Prima di implementare questa parte è necessario ridisegnare il processo insieme a HR e Team IT, evitando di digitalizzare alla lettera un flusso attuale che è già inutilmente complesso.

# Feature secondarie

Le seguenti funzionalità sono considerate utili, ma non prioritarie rispetto alle aree descritte sopra.

## 7. Area Aziende

Possibili funzionalità:

- pubblicazione di annunci di lavoro e stage;
- eventuale consultazione dei CV dei membri, esclusivamente con un sistema di consenso e gestione privacy adeguato.

La funzionalità deve essere progettata in dettaglio prima dello sviluppo.

## 8. Area Proprietari di casa

Possibile area dedicata ai proprietari per la pubblicazione di annunci immobiliari relativi ad affitto o vendita di camere e appartamenti.

## 9. Bacheca ricerca casa e coinquilini

Possibile area dedicata agli utenti che vogliono pubblicare annunci per:

- ricerca di una stanza o appartamento;
- ricerca di coinquilini;
- altre esigenze collegate alla bacheca casa.

## 10. Newsletter

La newsletter è una feature secondaria e non deve bloccare lo sviluppo della prima versione della dashboard.

In futuro potrà utilizzare i dati già presenti nella piattaforma, in particolare gli eventi inseriti dalle associazioni partner, per semplificare la selezione e la pubblicazione dei contenuti.

Il modello editoriale, il sistema di approvazione e il provider di invio verranno definiti in una fase successiva.
