# Admin Dashboard PoliNetwork

**Documento di specifica funzionale per il Team IT**
**Versione:** 0.3
**Data:** 20 agosto 2026
**Stato:** Bozza per revisione
**Modifiche rispetto alla v0.2:** riordino delle priorità (interno prima di esterno), aggiunta di modello dati, ruoli e permessi, macchine a stati, criteri di accettazione e decisioni tecniche proposte.

---

## 1. Scopo e principi

### 1.1 Obiettivo

Portare dentro un'unica piattaforma i processi oggi distribuiti tra form, fogli Excel, email, gruppi e operazioni manuali, mantenendo ogni area modulare e sviluppabile in modo indipendente.

### 1.2 Principio di priorità: interno prima di esterno

La v0.2 metteva l'Area Associazioni Partner come feature n.1. Questa versione la sposta in Fase 2. Motivi:

1. **Dipendenza tecnica.** L'area partner richiede autenticazione multi-tenant, ruoli con scope, flussi di approvazione, gestione allegati e pagine pubbliche. Sono tutti pezzi che vanno costruiti comunque per l'uso interno: costruirli prima per l'interno e poi riusarli per i partner riduce il lavoro complessivo.
2. **Dipendenza organizzativa.** L'area partner ha utenti esterni: un bug, un dato sbagliato o un downtime diventano subito un problema di immagine. L'interno è un ambiente tollerante in cui rodare la piattaforma.
3. **Ritorno immediato.** Anagrafica, rinnovi e onboarding eliminano lavoro manuale che oggi ricade su Direttivo, HR e Capi Admin ogni settimana.
4. **Prerequisito di dati.** Le associazioni partner vanno collegate a referenti, ruoli e permessi che esistono solo se l'anagrafica interna è già in piedi.

Il PoliTamTam resta la feature esterna a priorità più alta ed è la prima cosa che si sviluppa una volta chiusa la Fase 1.

### 1.3 Principi di progetto

- **Un'unica fonte di verità per le persone.** Ogni persona esiste una volta sola nel sistema; ruoli, tesseramento e appartenenze sono attributi collegati, non copie.
- **Permessi per capability, non per ruolo hardcoded.** Il codice controlla permessi; i ruoli sono insiemi di permessi configurabili.
- **Ogni scrittura è tracciata.** Audit log append-only su tutte le azioni che modificano dati o inviano comunicazioni.
- **Ogni invio automatico è idempotente.** Nessuna email deve poter partire due volte per lo stesso evento.
- **Modularità.** Ogni area è un modulo attivabile/disattivabile, con proprie tabelle e propri permessi.
- **Minimizzazione dei dati.** Si raccoglie solo ciò che serve a un processo descritto in questo documento.

---

## 2. Fondamenta (Fase 0 — prerequisito di tutto)

Non è una feature visibile, ma è la parte da cui dipendono tutte le altre. Va sviluppata per prima e in modo definitivo.

### 2.1 Identità e autenticazione

**Decisione proposta (da confermare con il Team IT):**

- **Utenti interni** (soci, admin, capi admin, team, direttivo): SSO tramite Google Workspace PoliNetwork (OIDC), account `@polinetwork.org`. Nessuna password gestita dalla dashboard.
- **Utenti partner** (Fase 2): account applicativi con email `@polinetwork.org` dedicata all'associazione, login con magic link via email + sessione a scadenza. Nessuna password da ricordare, nessun reset da gestire manualmente.
- **Sessioni:** durata 30 giorni per gli interni, 7 giorni per i partner, revocabili singolarmente dal superadmin.
- **2FA:** obbligatoria (tramite Google) per superadmin e Direttivo.

**Requisiti minimi in ogni caso:**

- creazione, sospensione, riattivazione e disattivazione di un account senza cancellare i dati storici;
- cambio del referente di un account senza perdere lo storico delle azioni;
- possibilità futura di più referenti per la stessa entità (associazione, team, corso);
- pannello centralizzato per PoliNetwork con elenco account, ultimo accesso, stato, ruoli.

### 2.2 Ruoli e permessi

Ogni assegnazione di ruolo ha uno **scope**: globale, corso di studi, team o associazione.

| Ruolo | Scope | Descrizione |
|---|---|---|
| `superadmin` | globale | Team IT. Accesso completo, gestione account e configurazioni. |
| `direttivo` | globale | Visione su soci, tesseramenti, approvazioni, statistiche. |
| `hr` | globale | Gestione candidature e onboarding. |
| `capo_admin` | corso di studi | Vede e gestisce admin e gruppi del proprio corso. |
| `admin` | corso di studi | Vede i propri dati e i gruppi di cui fa parte. |
| `team_lead` | team | Gestisce l'area del proprio team e i suoi membri. |
| `team_member` | team | Accede all'area del proprio team. |
| `socio` | personale | Vede e aggiorna il proprio profilo e il proprio stato associativo. |
| `partner_referente` | associazione | Fase 2. Gestisce l'area della propria associazione. |

Regole:

- una persona può avere più ruoli contemporaneamente, anche su scope diversi;
- i permessi sono l'unione dei permessi dei ruoli attivi;
- ogni ruolo ha `valido_da` e `valido_a`, così lo storico resta consultabile;
- il permesso è sempre verificato lato server, mai solo nascondendo un elemento nell'interfaccia.

### 2.3 Modello dati minimo

**`persona`** — anagrafica unica
`id`, `nome`, `cognome`, `email_personale`, `email_polinetwork`, `telefono`, `telegram_username`, `telegram_id`, `data_nascita`, `corso_di_studi_id`, `anno_corso`, `data_ingresso`, `data_uscita`, `stato` (`attivo` | `sospeso` | `uscito`), `is_rappresentante`, `note`, `creato_il`, `aggiornato_il`

**`altra_associazione`** — appartenenze esterne dichiarate
`id`, `persona_id`, `nome_associazione`, `ruolo`, `dal`, `al`

**`ruolo_assegnato`**
`id`, `persona_id`, `ruolo`, `scope_type` (`globale` | `corso` | `team` | `associazione`), `scope_id`, `valido_da`, `valido_a`, `assegnato_da`

**`corso_di_studi`**
`id`, `nome`, `codice`, `sede`, `livello` (triennale/magistrale/ciclo unico), `attivo`

**`team`**
`id`, `nome`, `slug`, `descrizione`, `lead_persona_id`, `attivo`

**`tesseramento`**
`id`, `persona_id`, `anno_associativo`, `data_iscrizione`, `data_scadenza`, `stato`, `importo`, `metodo_pagamento`, `verificato_da`, `verificato_il`, `note`

**`gruppo_chat`**
`id`, `nome`, `piattaforma` (`whatsapp` | `telegram`), `link_invito`, `corso_di_studi_id`, `tipo` (corso, anno, generale, altro), `responsabile_persona_id`, `attivo`, `iscritti_stimati`

**`candidatura`** (onboarding)
`id`, `nome`, `cognome`, `email`, `telefono`, `telegram_username`, `corso_di_studi_id`, `anno_corso`, `motivazione`, `disponibilita`, `stato`, `assegnata_a`, `creata_il`, `aggiornata_il`, `persona_id` (valorizzato all'approvazione)

**`colloquio`**
`id`, `candidatura_id`, `intervistatore_persona_id`, `data_ora`, `luogo_o_link`, `esito`, `note`

**`audit_log`** — append-only
`id`, `attore_persona_id`, `azione`, `entita_tipo`, `entita_id`, `dati_prima`, `dati_dopo`, `ip`, `timestamp`

**`email_log`** — append-only
`id`, `tipo_email`, `destinatario_persona_id`, `destinatario_email`, `chiave_idempotenza`, `stato` (`inviata` | `fallita` | `bounce`), `provider_message_id`, `inviata_il`, `errore`

`chiave_idempotenza` è univoca ed è costruita come `{tipo}:{persona_id}:{periodo}` — esempio: `compleanno:412:2026`. Questo è ciò che rende impossibile il doppio invio.

Entità di Fase 2 (`associazione_partner`, `richiesta_pubblicazione`, `evento`, `movimento_credito`, `richiesta_modifica_pagina`) sono definite nella sezione 8.

### 2.4 Sistema di invio email

**Decisione proposta:** provider transazionale con API e webhook di delivery (Resend, Postmark o Amazon SES). Requisiti:

- sottodominio dedicato per le transazionali, con SPF, DKIM e DMARC configurati, separato dal dominio usato per la newsletter, per non contaminare la reputazione di invio;
- template versionati nel repository, non nell'interfaccia del provider;
- ogni invio scrive su `email_log` prima di partire e aggiorna lo stato al webhook;
- job schedulati eseguiti una volta al giorno a orario fisso (proposta: 08:00 Europe/Rome), idempotenti, con recupero automatico dei giorni saltati;
- pagina di monitoraggio per il superadmin con invii recenti, fallimenti e bounce;
- ambiente di staging che scrive su `email_log` senza inviare realmente.

### 2.5 Audit e privacy

- Ogni azione che modifica dati o invia comunicazioni scrive su `audit_log`.
- Retention: dati dei soci conservati per la durata dell'appartenenza + 5 anni per obblighi associativi e fiscali; candidature non approvate cancellate dopo 12 mesi; log conservati 24 mesi.
- Ogni campo raccolto deve corrispondere a un processo descritto in questo documento. Campi senza processo non si raccolgono.
- Numero di telefono e contatto Telegram sono visibili solo a chi ha un ruolo con permesso esplicito (capo admin sul proprio corso, direttivo, HR), mai in elenchi pubblici o esportabili senza tracciamento.
- Ogni esportazione di dati personali (CSV) viene registrata su `audit_log` con attore, filtri applicati e numero di record.

### 2.6 Criteri di accettazione Fase 0

- Un utente interno accede con account Google PoliNetwork e vede solo i moduli permessi dai propri ruoli.
- Un tentativo di accesso via API a una risorsa fuori dal proprio scope restituisce 403 e viene loggato.
- Il superadmin può assegnare, revocare e datare un ruolo e vedere lo storico delle assegnazioni.
- Un'email di test parte, compare in `email_log` e il rilancio manuale dello stesso job non produce un secondo invio.

---

# Parte I — Feature interne (prioritarie)

## 3. Anagrafica persone (Fase 1)

Base di tutte le altre feature interne. Sostituisce i fogli Excel oggi in uso.

### 3.1 Requisiti

- Elenco unico delle persone di PoliNetwork con i campi della tabella `persona`.
- Scheda persona con: dati anagrafici, corso e anno, data di ingresso e anzianità calcolata, ruoli attivi e storici, team di appartenenza, altre associazioni, stato associativo corrente, storico delle azioni che la riguardano.
- Ogni persona può aggiornare autonomamente i propri dati di contatto (telefono, Telegram, email personale). Corso, anno di ingresso, ruoli e stato associativo sono modificabili solo da chi ha il permesso.
- Import iniziale da Excel con file di mappatura colonne, report degli scarti e possibilità di rieseguire l'import senza creare duplicati (chiave: email personale, con controllo manuale dei conflitti).
- Ricerca full-text su nome, cognome, email e username Telegram.

### 3.2 Criteri di accettazione

- L'import dei fogli attuali produce zero duplicati e un report leggibile degli scarti.
- Modificare il numero di telefono dal proprio profilo aggiorna il dato visto dal Capo Admin senza altri passaggi.
- L'anzianità è sempre calcolata da `data_ingresso`, mai inserita a mano.

---

## 4. Dashboard Admin e Capo Admin (Fase 1)

### 4.1 Vista Capo Admin

Il Capo Admin vede l'elenco degli admin del **proprio corso di studi**, con:

- nome e cognome;
- anno di corso;
- data di ingresso in PoliNetwork e anzianità;
- indicazione se è rappresentante;
- altre associazioni di cui fa parte;
- numero di telefono;
- username o contatto Telegram;
- stato associativo (attivo / in scadenza / scaduto);
- pulsanti di contatto rapido: `wa.me/{telefono}` e `t.me/{username}`, aperti in nuova scheda.

### 4.2 Filtri e ricerca

- ricerca testuale per nome e cognome;
- filtro per anno di corso;
- filtro per rappresentante sì/no;
- filtro per appartenenza ad altre associazioni (presenza o nome specifico);
- filtro per stato associativo;
- ordinamento per cognome, anno, data di ingresso;
- esportazione CSV del risultato filtrato, tracciata su `audit_log`.

### 4.3 Link dei gruppi

Sezione con i gruppi WhatsApp e Telegram di competenza del Capo Admin: nome, piattaforma, corso, tipo, link di invito con copia rapida, responsabile, stato attivo/archiviato.

Il Capo Admin può proporre l'aggiunta o la modifica di un link; la modifica diventa effettiva dopo conferma di un superadmin (i link di invito sono dati sensibili per lo spam).

### 4.4 Regole di visibilità

- `capo_admin` vede esclusivamente persone e gruppi con `corso_di_studi_id` incluso nel proprio scope; può avere più corsi assegnati.
- `admin` vede solo la propria scheda e i gruppi di cui fa parte.
- `direttivo` e `superadmin` vedono tutti i corsi.
- Il tentativo di accedere a una persona fuori scope produce 403, non una lista vuota.

### 4.5 Criteri di accettazione

- Un Capo Admin con due corsi assegnati vede l'unione dei due e nient'altro.
- Il link WhatsApp precompilato apre correttamente la chat con il numero in formato internazionale.
- Cambiare il corso di una persona la fa sparire immediatamente dalla vista del vecchio Capo Admin.

---

## 5. Gestione Soci e Rinnovi (Fase 1)

### 5.1 Stati del tesseramento

`tesseramento.stato` assume esclusivamente questi valori:

| Stato | Significato |
|---|---|
| `attivo` | Tesseramento valido, non ancora in finestra di rinnovo. |
| `in_scadenza` | Entro N giorni dalla scadenza. Il reminder automatico è partito o sta per partire. |
| `sollecitato` | Almeno un reminder inviato dopo la scadenza. |
| `da_verificare` | Il socio dichiara di aver pagato, il Direttivo non ha ancora confermato. |
| `pagato` | Pagamento confermato dal Direttivo. Genera il nuovo tesseramento attivo. |
| `scaduto` | Scadenza superata senza rinnovo oltre la finestra di tolleranza. |

**Parametri configurabili** (valori proposti): primo reminder 30 giorni prima della scadenza; secondo reminder 7 giorni prima; terzo il giorno della scadenza; tolleranza 30 giorni prima del passaggio a `scaduto`.

### 5.2 Rinnovo automatico via email

- Job giornaliero che seleziona i tesseramenti in finestra di reminder e invia la mail di rinnovo.
- La mail contiene: scadenza, importo, istruzioni di pagamento secondo il processo associativo vigente, link alla propria pagina di stato nella dashboard.
- In questa versione **il pagamento non avviene nella dashboard**. La dashboard registra e verifica, non incassa.
- Ogni invio è protetto da `chiave_idempotenza` (`rinnovo_r1:{persona_id}:{anno}`), quindi il rilancio del job non genera duplicati.

### 5.3 Vista Direttivo

Tabella dei soci filtrabile per stato, anno associativo, corso, team. Per ogni socio due azioni:

**Segna come pagato**
Imposta `stato = pagato`, registra `verificato_da` e `verificato_il`, crea il tesseramento del nuovo anno, invia automaticamente la mail di conferma al socio, scrive su `audit_log`.

**Invia reminder**
Invia una nuova mail di promemoria, registra l'invio su `email_log`, aggiorna `stato` a `sollecitato`. Limite: massimo un reminder manuale ogni 7 giorni per socio, per evitare invii ripetuti da più membri del Direttivo.

Sulla scheda del socio è visibile lo storico: quando è stato inviato ogni reminder, chi ha confermato il pagamento e quando.

### 5.4 Informazioni sul socio

Nella scheda, dove utile: data di ingresso, anzianità, ruoli ricoperti (attuali e passati), team di appartenenza, corso di studi, stato associativo corrente e storico dei tesseramenti per anno.

### 5.5 Criteri di accettazione

- Un socio con scadenza tra 30 giorni riceve esattamente una mail, anche se il job viene eseguito due volte.
- "Segna come pagato" produce: stato aggiornato, mail di conferma inviata, riga di audit, nuovo tesseramento creato.
- Due membri del Direttivo che premono "Invia reminder" sullo stesso socio nello stesso giorno producono un solo invio.
- Il Direttivo può esportare l'elenco dei non in regola in CSV.

---

## 6. Onboarding nuovi Admin (Fase 1)

### 6.1 Premessa

Il processo attuale è frammentato tra form, email, colloqui, fogli Excel e passaggi manuali. **Non va digitalizzato così com'è.** Prima dello sviluppo, HR e Team IT devono ridisegnare il flusso, eliminando i passaggi che esistono solo perché mancava uno strumento.

Il flusso descritto qui è la proposta di riferimento da validare con HR.

### 6.2 Pipeline della candidatura

`ricevuta` → `in_screening` → `colloquio_da_programmare` → `colloquio_programmato` → `colloquio_effettuato` → `approvata` | `respinta` → `onboarding_in_corso` → `completata`

Stati aggiuntivi: `ritirata` (il candidato rinuncia), `in_attesa` (rimandata a una tornata successiva).

### 6.3 Requisiti

- **Form di candidatura pubblico** servito dalla dashboard, che scrive direttamente su `candidatura`. Nessun Google Form.
- **Board delle candidature** per HR: colonne per stato, assegnazione a un referente, filtri per corso e tornata.
- **Gestione colloquio**: registrazione di data, ora, luogo o link, intervistatore, esito e note. Invio automatico della convocazione al candidato e del promemoria il giorno prima.
- **Approvazione**: alla transizione ad `approvata`, il sistema crea la `persona` collegata, imposta `data_ingresso`, assegna corso, ruolo `admin` e gli eventuali team, e invia la mail di benvenuto con i passi successivi.
- **Checklist di ingresso operativo** con voci configurabili (esempi: account `@polinetwork.org` creato, inserito nei gruppi di competenza, formazione iniziale svolta, tesseramento avviato). La candidatura passa a `completata` solo quando la checklist è chiusa.
- **Comunicazione al candidato**: ogni cambio di stato rilevante genera una mail automatica; l'esito negativo usa un template dedicato con invio manuale confermato da HR.

### 6.4 Criteri di accettazione

- Da candidatura ad admin operativo non serve nessuno strumento esterno alla dashboard oltre alla creazione dell'account Google.
- L'approvazione crea la persona senza reinserimento manuale dei dati già raccolti dal form.
- HR vede in ogni momento quante candidature sono ferme in ciascuno stato e da quanti giorni.

---

## 7. Aree Team (Fase 1, struttura — Fase 3, contenuti)

### 7.1 Team previsti

Team IT, Team Design & Social, Team International, Team HR, Team Events & Partnerships.

### 7.2 Cosa si sviluppa ora

Solo l'impalcatura, identica per tutti i team:

- pagina del team con elenco membri, ruoli interni e lead;
- permessi: `team_member` vede l'area, `team_lead` gestisce membri e contenuti;
- spazio per note e documenti condivisi del team;
- bacheca annunci interna al team;
- struttura a moduli che permette di aggiungere strumenti specifici in seguito senza toccare le altre aree.

### 7.3 Cosa non si sviluppa ora

Gli strumenti specifici di ciascun team. Vanno definiti separatamente con i rispettivi responsabili, dopo che la struttura è in produzione e i team la stanno effettivamente usando.

### 7.4 Criteri di accettazione

- Aggiungere un nuovo team è un'operazione di configurazione, non di sviluppo.
- Un membro di un team non vede le aree degli altri team se non ha ruoli su di essi.

---

## 8. Email automatiche di compleanno (Fase 1)

- Job giornaliero che seleziona le persone con `data_nascita` corrispondente alla data odierna e `stato = attivo` **e tesseramento valido** (la feature riguarda esclusivamente i soci).
- Invio di una mail di auguri da parte di PoliNetwork. Solo email: nessuna integrazione Telegram in questa fase.
- Idempotenza tramite chiave `compleanno:{persona_id}:{anno}`.
- Gestione del 29 febbraio: negli anni non bisestili l'invio avviene il 28 febbraio.
- Opt-out individuale disponibile nel profilo del socio.
- Se il job non gira in un dato giorno, all'esecuzione successiva recupera i compleanni saltati degli ultimi 3 giorni.

**Criterio di accettazione:** rilanciare il job tre volte nello stesso giorno produce un solo invio per persona.

---

# Parte II — Feature esterne

## 9. Area Associazioni Partner (Fase 2)

Prima area rivolta a utenti esterni. Si sviluppa dopo la Fase 1 e riusa autenticazione, ruoli, flussi di approvazione e sistema email già costruiti.

### 9.1 Entità

**`associazione_partner`**
`id`, `nome`, `slug`, `email_polinetwork`, `descrizione`, `logo_url`, `sito_web`, `instagram`, `linkedin`, `altri_link` (JSON), `contatti_pubblici`, `stato` (`attiva` | `sospesa` | `archiviata`), `crediti_disponibili`, `data_convenzione`, `data_rinnovo`

**`referente_partner`**
`id`, `associazione_id`, `persona_o_contatto`, `email`, `ruolo`, `attivo`
Struttura predisposta fin da subito per più referenti per associazione, anche se in v1 se ne usa uno.

**`richiesta_pubblicazione`**
`id`, `associazione_id`, `testo`, `allegati` (JSON), `link`, `gruppi_destinatari` (JSON), `data_richiesta`, `data_pubblicazione_desiderata`, `stato`, `crediti_costo`, `revisore_persona_id`, `motivo_rifiuto`, `pubblicata_il`

**`evento`**
`id`, `associazione_id`, `titolo`, `descrizione`, `data_inizio`, `data_fine`, `luogo`, `link_online`, `link_iscrizione`, `immagine_url`, `stato`, `data_rimozione`, `revisore_persona_id`, `motivo_rifiuto`

**`richiesta_modifica_pagina`**
`id`, `associazione_id`, `campi_modificati` (JSON con valore precedente e nuovo), `stato`, `richiesta_da`, `revisore_persona_id`, `motivo_rifiuto`

**`movimento_credito`**
`id`, `associazione_id`, `delta`, `causale`, `richiesta_id`, `saldo_risultante`, `creato_da`, `creato_il`

### 9.2 Accesso e gestione degli account

- PoliNetwork crea per ogni associazione partner un indirizzo `@polinetwork.org` dedicato, usato come identità di accesso.
- Login tramite magic link inviato a quell'indirizzo (vedi 2.1). Non ci sono password da recuperare.
- Il superadmin può: creare, sospendere, riattivare e archiviare un account; cambiare il referente mantenendo lo storico; vedere l'ultimo accesso di ogni associazione.
- Il cambio di referente non cancella nulla: le richieste passate restano attribuite all'associazione, non alla persona.
- La soluzione deve reggere ordinatamente **decine di associazioni**: nessuna configurazione manuale per associazione oltre alla creazione dell'account.

### 9.3 Richieste di pubblicazione nei gruppi

**Stati:** `bozza` → `inviata` → `in_revisione` → `approvata` → `programmata` → `pubblicata`, con uscite `respinta` e `annullata`.

Il partner compila: testo del messaggio, gruppi o insiemi di gruppi destinatari, allegati o link, data di pubblicazione desiderata. Vede lo stato della richiesta e lo storico completo delle richieste precedenti.

PoliNetwork revisiona, approva o respinge indicando il motivo. La pubblicazione effettiva nei gruppi in v1 è **manuale**: la dashboard produce il messaggio pronto e traccia lo stato. L'invio automatizzato verso Telegram/WhatsApp è fuori scope della v1 e va valutato separatamente (le API WhatsApp per i gruppi hanno vincoli rilevanti).

**Sistema a crediti (proposta da validare):**

- ogni associazione ha un saldo crediti;
- costo definito per invio, con moltiplicatore per numero di gruppi destinatari;
- i crediti si scalano **all'approvazione**, non all'invio della richiesta; una richiesta respinta non costa nulla;
- ricarica o rinnovo periodico impostato dal superadmin, con data di rinnovo visibile al partner;
- ogni movimento è registrato su `movimento_credito` e visibile al partner come estratto conto;
- il partner vede sempre: crediti disponibili, crediti utilizzati nel periodo, data del prossimo rinnovo.

Se il Direttivo decide di non usare i crediti, il modulo resta disattivabile via configurazione senza rimuovere il codice.

### 9.4 Pagina pubblica dell'associazione

Ogni associazione ha una pagina pubblica sul sito PoliNetwork. Dalla dashboard il partner **richiede** modifiche a: nome e informazioni principali, descrizione, logo, sito web, Instagram, LinkedIn, altri social, contatti pubblici.

Le modifiche non vanno mai in diretta: passano da `richiesta_modifica_pagina` con approvazione di PoliNetwork. Il revisore vede un confronto prima/dopo campo per campo e può approvare parzialmente.

### 9.5 Eventi delle associazioni — nuovo PoliTamTam

Evoluzione del PoliTamTam: punto unico in cui raccogliere e mostrare gli eventi delle associazioni sulla pagina eventi del sito PoliNetwork.

**Stati:** `bozza` → `in_approvazione` → `pubblicato` → `concluso` → `archiviato`, con uscita `respinto`.

**Decisione proposta:** gli eventi passano da approvazione di PoliNetwork prima della pubblicazione, coerentemente con il controllo editoriale sul sito. Eccezione configurabile: associazioni con status "verificato" pubblicano direttamente, con revisione a posteriori. Da confermare con il Team IT e il Direttivo.

Regole aggiuntive:

- rimozione automatica dalla pagina pubblica dopo `data_fine` (o dopo `data_rimozione` se valorizzata), con passaggio a `concluso`;
- gli eventi conclusi restano consultabili nell'archivio interno;
- il partner può modificare un evento già pubblicato solo su campi non critici (descrizione, immagine, link iscrizione); modifiche a data, luogo o titolo rientrano in approvazione;
- immagini validate per formato e dimensione massima, servite ridimensionate.

### 9.6 Criteri di accettazione Fase 2

- Un'associazione accede, inserisce un evento e lo vede sul sito entro un'approvazione, senza email a PoliNetwork.
- Una richiesta respinta non consuma crediti e mostra al partner il motivo del rifiuto.
- Un'associazione non vede in nessun modo dati di altre associazioni.
- Un evento concluso sparisce dalla pagina pubblica senza intervento manuale.

---

# Parte III — Feature secondarie (Fase 3+)

Utili, ma non devono ritardare le fasi precedenti. Ognuna richiede una progettazione dedicata prima dello sviluppo.

## 10. Area Aziende

Pubblicazione di annunci di lavoro e stage. Eventuale consultazione dei CV dei membri **solo** con consenso esplicito, revocabile, per singola azienda o per categoria, e con tracciamento di ogni accesso al CV. Senza un modello privacy approvato, la parte CV non si sviluppa.

## 11. Area Proprietari di casa

Area per la pubblicazione di annunci di affitto o vendita di camere e appartamenti. Richiede: verifica dell'identità dell'inserzionista, moderazione degli annunci, scadenza automatica, gestione delle segnalazioni.

## 12. Bacheca ricerca casa e coinquilini

Annunci di ricerca stanza/appartamento, ricerca coinquilini e affini, riservata agli utenti autenticati. Richiede moderazione e scadenza automatica degli annunci.

## 13. Newsletter

Non deve bloccare la v1. In futuro riusa i dati già in piattaforma, in particolare gli eventi inseriti dalle associazioni partner, per comporre i contenuti. Modello editoriale, flusso di approvazione e provider di invio da definire in seguito. **Vincolo tecnico:** dominio o sottodominio di invio separato da quello delle email transazionali (vedi 2.4).

---

## 14. Riepilogo delle fasi

| Fase | Contenuto | Dipendenze |
|---|---|---|
| **0 — Fondamenta** | Auth, ruoli e permessi, modello dati, audit log, sistema email | Nessuna |
| **1 — Interno** | Anagrafica, Dashboard Admin/Capo Admin, Soci e Rinnovi, Onboarding, struttura Aree Team, compleanni | Fase 0 |
| **2 — Partner** | Account partner, PoliTamTam, richieste di pubblicazione, pagina pubblica, crediti | Fase 1 |
| **3 — Estensioni** | Strumenti specifici dei team, Aziende, Casa, Bacheca, Newsletter | Fase 2 |

L'ordine indica dipendenze, non date. Le stime temporali vanno fatte dal Team IT sulla base della capacità effettiva.

---

## 15. Fuori scope della v1

Da dichiarare esplicitamente per evitare aspettative:

- pagamento delle quote direttamente in dashboard;
- invio automatizzato di messaggi verso gruppi WhatsApp e Telegram;
- integrazione Telegram per gli auguri di compleanno;
- app mobile;
- consultazione CV da parte delle aziende;
- newsletter.

---

## 16. Decisioni ancora aperte

Vanno chiuse prima dell'inizio dello sviluppo della fase corrispondente.

| # | Decisione | Chi decide | Blocca |
|---|---|---|---|
| 1 | Conferma di Google Workspace come IdP per gli interni | Team IT | Fase 0 |
| 2 | Scelta del provider email transazionale | Team IT | Fase 0 |
| 3 | Stack e hosting della piattaforma | Team IT | Fase 0 |
| 4 | Parametri dei reminder di rinnovo (giorni e tolleranza) | Direttivo | Fase 1 |
| 5 | Ridisegno del flusso di onboarding | HR + Team IT | Fase 1 |
| 6 | Contenuto dei template email (rinnovo, conferma, benvenuto, compleanno) | Direttivo + Design & Social | Fase 1 |
| 7 | Uso o meno del sistema a crediti e relativo listino | Direttivo | Fase 2 |
| 8 | Approvazione preventiva o pubblicazione diretta degli eventi partner | Direttivo + Team IT | Fase 2 |
| 9 | Modello privacy per la consultazione dei CV | Direttivo | Fase 3 |
