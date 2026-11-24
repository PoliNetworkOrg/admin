# Registro e portale delle associazioni

Ogni persona accede a `admin.polinetwork.org` con il proprio account. Non riceve permessi amministrativi globali: il backend verifica a ogni operazione il collegamento alla singola associazione. Gli operatori PoliNetwork che possiedono insieme `admin:access` e `web:content:write` gestiscono registro e approvazioni.

## Tre decisioni distinte

1. **Registrazione**: la persona propone nome, sigla, informazioni e motivazione privata del proprio ruolo. PoliNetwork verifica e approva l'associazione e il primo responsabile. Una registrazione inserita direttamente da un operatore può rimanere senza referenti.
2. **Rappresentanza**: una persona richiede accesso a un'associazione esistente, oppure riceve un invito. L'invito si accetta con un account personale e PoliNetwork approva esattamente quell'account. Nome ed email non assegnano mai automaticamente accesso.
3. **Pubblicazione**: responsabili e collaboratori preparano una proposta; il responsabile la invia. Solo l'approvazione PoliNetwork cambia la scheda pubblicata. Registrare un'associazione non la pubblica.

Una richiesta duplicata di registrazione può essere trasferita da PoliNetwork al record esistente come richiesta di accesso, senza attribuire automaticamente alcun ruolo.

## Ruoli e schermate

| Persona                        | Funzioni                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Autenticata senza collegamenti | Registra un'associazione, cerca il registro per nome, chiede accesso, segue le proprie richieste           |
| Collaboratore                  | Legge la propria associazione e prepara modifiche della scheda                                             |
| Responsabile                   | Anche invio per pubblicazione, inviti e proposte di modifica dei referenti                                 |
| Operatore PoliNetwork          | Registro completo, richieste, approvazioni, note interne, sospensione, oscuramento, archiviazione e revoca |

`/dashboard/associations` presenta le associazioni accessibili, le richieste e la ricerca per chiedere accesso. Il dettaglio separa scheda, richieste, referenti e attività. L'invito atterra su `/associations/invite`, conserva il ritorno dopo il login e mostra l'account prima dell'accettazione.

La scheda comprende nome, sigla, descrizioni italiana e inglese, email pubblica, logo e fino a 30 link con piattaforma, etichetta e URL. Si possono inserire più link Telegram, Twitch o altri canali della stessa piattaforma. Il logo può essere un URL HTTP/S oppure un PNG/JPEG fino a 1 MiB caricato dopo il salvataggio iniziale. Motivazioni di rappresentanza, email degli inviti e note interne non finiscono sul sito pubblico.

## Pagina iniziale

In cima ad Associazioni compare **Da fare**: le azioni che chiedono attenzione, calcolate dal backend (`associationPortal.home`) sullo stato attuale e mai salvate, con prima quelle urgenti. Per esempio: modifiche chieste da PoliNetwork alla scheda o a una richiesta di promozione, bozze da completare (l’autore) o da inviare (il responsabile), contatti pubblici da confermare, contatti da aggiornare perché il referente collegato non ha più accesso, una scheda registrata ma non pubblicata, promozioni programmate nella settimana o appena pubblicate, integrazioni chieste a una propria richiesta di registrazione o di accesso. Ogni voce porta alla pagina dove si risolve. Gli operatori vedono anche i contatori delle code: schede, accessi e promozioni in revisione.

## Corsi, sedi e contatti

La scheda indica uno o più corsi di studio e una o più sedi scelti dal catalogo di PoliNetwork, oppure dichiara l’associazione **trasversale** a tutti i corsi (in quel caso non elenca corsi). Corsi e sedi fanno parte della scheda pubblica e passano dalla revisione. Gli operatori gestiscono il catalogo in Associazioni › Corsi e sedi: aggiungono, rinominano e ritirano voci, mai le cancellano. Le chiavi dei corsi seguono le etichette dei gruppi (`didattica.<scuola>.<livello>.<corso>`); una voce ritirata resta sulle schede che già la citano ma non si può più scegliere.

I contatti sono organizzati per funzione (presidenza, eventi, collaborazioni, comunicazione, altro) con etichetta ed email, nome e telefono facoltativi. Ogni contatto ha una visibilità:

| Visibilità         | Chi lo vede                                                    | Revisione                                |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------- |
| Pubblico           | Tutti, sul sito, dopo l’approvazione                           | Entra nella proposta di scheda           |
| Altre associazioni | I referenti delle associazioni attive, nell’elenco del portale | Nessuna; la modifica resta nello storico |
| Solo PoliNetwork   | I referenti dell’associazione e gli operatori                  | Nessuna; la modifica resta nello storico |

Lo storico registra etichetta e visibilità, mai nomi o numeri di telefono. Quando si inseriscono nome o telefono il portale mostra l’avviso sui dati personali. Un contatto può essere collegato al referente a cui si riferisce: se quel referente lascia l’associazione o viene revocato, il contatto è segnalato al responsabile come da aggiornare.

L’elenco delle associazioni nel portale mostra a ciascuno solo i contatti che può vedere: i contatti pubblici approvati a tutti, quelli per le altre associazioni a chi rappresenta un’associazione attiva, tutti ai propri referenti e agli operatori.

## Richieste di promozione

Un referente chiede a PoliNetwork di promuovere un evento, un annuncio o un bando: titolo, testo, link, locandina facoltativa (stesso storage dei loghi, PNG o JPEG fino a 5 MB), canali richiesti, pubblico (tutti, oppure corsi e sedi), data desiderata e scadenza facoltativa. I canali seguono l’art. 4.7 dell’RRI: canale PoliAssociazioni, canale broadcast di un corso, gruppo di un esame o scaglione, gruppo generale di livello, tutti i gruppi di un corso, altro (lo valuta PoliNetwork).

| Stato               | Chi agisce                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Bozza               | Collaboratori e responsabili preparano e modificano                                                              |
| In revisione        | Solo il responsabile invia                                                                                       |
| Modifiche richieste | PoliNetwork chiede modifiche; i referenti aggiornano e il responsabile reinvia                                   |
| Approvata           | PoliNetwork approva                                                                                              |
| Programmata         | PoliNetwork fissa data, ora e canale effettivi                                                                   |
| Pubblicata          | PoliNetwork segna la pubblicazione con il link                                                                   |
| Respinta / Ritirata | PoliNetwork respinge (anche dopo l’approvazione); il responsabile ritira, l’autore può ritirare la propria bozza |

Ogni passaggio registra chi l’ha fatto e quando e invia un’email all’autore e a chi ha inviato la richiesta. Gli operatori possono aggiungere note interne, mai visibili ai referenti. La pubblicazione sui canali resta manuale. Gli operatori trovano la coda in Associazioni › Promozioni, filtrabile per stato e date; i referenti trovano le richieste nella scheda Promozioni della propria associazione.

## Eventi e collaborazioni

Un’associazione propone eventi per il calendario condiviso: titolo, descrizione italiana e inglese, inizio e fine facoltativa, luogo oppure online, sede facoltativa, link e locandina. Collaboratori e responsabili preparano la bozza, il responsabile la invia; PoliNetwork commenta, chiede modifiche, approva o respinge. Un evento compare nel calendario del sito solo dopo l’approvazione, e il responsabile può toglierlo in ogni momento. Gli operatori trovano gli eventi in Associazioni › Eventi.

Da un evento approvato i referenti possono creare una richiesta di promozione già compilata (titolo, testo, link, locandina, data qualche giorno prima), collegata all’evento.

Nell’elenco delle associazioni un’associazione può dichiararsi aperta a collaborazioni e indicare il contatto dedicato, scelto tra i suoi contatti. Il flag è visibile a tutti nel portale; il contatto solo a chi può già vederlo secondo la sua visibilità. Non serve approvazione.

## Passaggio di consegne

Il responsabile uscente avvia il passaggio dalla scheda Referenti. Il portale lo guida in tre passi: invitare chi gli succede come responsabile (l’invito e l’approvazione PoliNetwork sono quelli di sempre), rivedere i contatti con nome o telefono o collegati a lui e confermarli, controllare le richieste di promozione e gli eventi ancora aperti. Può completarlo solo quando c’è un altro responsabile approvato e i contatti sono confermati, scegliendo se lasciare l’associazione nello stesso momento. Il passaggio si chiude da solo se il responsabile uscente lascia o viene revocato; PoliNetwork può chiudere un passaggio fermo. Gli operatori vedono i passaggi in corso nel registro e nel contatore della pagina iniziale.

Chi subentra eredita tutto: scheda, storico, richieste di promozione ed eventi appartengono all’associazione, non alla persona. Restano private solo le evidenze delle richieste di accesso altrui.

## Crediti

I crediti seguono l’art. 4.7 dell’RRI e sono **spenti** finché PoliNetwork non li attiva in Associazioni › Crediti. Le regole iniziali vengono dall’RRI e sono modificabili dagli operatori, su indicazione del Direttivo: 3 crediti a semestre, non cumulabili; costo per invio di 0 sul canale PoliAssociazioni, 1 sul canale broadcast del corso, 0,5 per un gruppo d’esame o di scaglione, 2 per un gruppo generale di livello, 3 per tutti i gruppi di un corso, mentre i casi “Altro” li prezza PoliNetwork all’approvazione; metà prezzo sui canali del corso a cui l’associazione fa riferimento; nessun saldo negativo; 15 giorni tra due messaggi nello stesso gruppo.

Il registro dei crediti è in sola aggiunta: accrediti, addebiti, storni e rettifiche, ciascuno con motivazione, autore e, se c’è, la richiesta collegata. Il saldo è la somma dei movimenti. Con i crediti attivi i referenti vedono saldo, movimenti e uso previsto nella scheda Crediti, e il costo stimato di una richiesta prima di inviarla. L’addebito avviene all’approvazione e viene stornato se la richiesta è respinta o ritirata dopo l’approvazione; un addebito non può mai essere registrato due volte. Gli operatori assegnano crediti e rettifiche con motivazione, e assegnano i crediti del semestre a tutte le associazioni attive (una volta per periodo, facendo scadere quelli non usati).

Restano da decidere: un permesso dedicato per i crediti (oggi bastano `admin:access` e `web:content:write`) e come applicare il credito aggiuntivo per i corsi poco numerosi (oggi è una rettifica manuale, senza vincolo di spesa su quei corsi).

## Stati e gestione dei referenti

Le richieste passano per bozza, invio, eventuali integrazioni, approvazione/rifiuto o ritiro. Le modifiche inviate restano separate dalla versione pubblicata, anche durante un rifiuto. La scheda richiede entrambe le descrizioni per essere pubblicata.

Gli inviti scadono dopo 14 giorni, sono monouso e sono invalidati dal ritiro. Ogni nuovo collegamento e ogni cambio di ruolo richiede approvazione. La rimozione ordinaria dell'ultimo responsabile richiede prima un sostituto; l'abbandono personale o una revoca esplicita PoliNetwork sono immediati e lasciano il record segnalato come privo di responsabile.

La sospensione blocca le modifiche dei referenti e può mantenere visibile la scheda; l'oscuramento la rimuove dal sito. L'archiviazione conserva registro e storico, blocca la gestione e oscura la scheda. Le note interne sono visibili solo agli operatori. Ogni richiedente vede soltanto le proprie evidenze; i referenti vedono anche le proposte di contenuto della propria associazione.

## Contratto e rilascio

Il backend espone `associationPortal.*`. I suoi messaggi di errore sono frasi inglesi fisse: `portal-errors.ts` le traduce in italiano dove l’API risponde, e mostra così com’è un messaggio sconosciuto. Il BFF valida tutte le risposte con `portal.contract.ts`, copia del contratto backend. Login OIDC, sessioni Redis e controllo Origin restano quelli esistenti. L'accesso alla shell è aperto agli account autenticati con una risposta fresca di `me.access`; i singoli servizi interni continuano a richiedere i propri permessi.

Il backend conserva registro, richieste, storico e collegamenti in un aggregato transazionale PostgreSQL. Revisioni ottimistiche, blocchi di riga e chiavi di idempotenza proteggono da approvazioni concorrenti e retry. Le email usano una coda durevole con retry; lo stato è consultabile anche nel portale. Nessuna modifica deve essere ripetuta solo perché il successivo aggiornamento della pagina fallisce.

Le tre PR vanno coordinate: migrazione e backend, poi admin; il sito supporta sia la vecchia risposta sia `extraLinks`. Durante il breve intervallo tra backend e admin, il vecchio editor rifiuta le scritture. La migrazione conserva identificativi e schede pubbliche esistenti, senza assegnare referenti. Verificare `ESIGN_DASHBOARD_URL=https://admin.polinetwork.org`, configurazione email e storage Azure del backend. Non sono richieste nuove autorizzazioni globali nel repository Auth.

Il rilascio richiede backup e normale procedura di migrazione del backend. Queste PR non eseguono migrazioni né deployment in produzione. Dopo il rilascio verificare login reale, consegna invito via email e caricamento logo contro i servizi configurati; la prova automatizzata locale usa account e recapiti fittizi.

## Rilascio delle funzioni aggiuntive

Ordine: backend (migrazioni 0041–0045), poi admin; il sito può andare prima o dopo. L’admin legge anche le risposte del backend precedente (i campi nuovi hanno valori predefiniti), ma le nuove schermate richiedono il nuovo backend. Dopo il rilascio: controllare i nomi dei corsi importati dalle etichette dei gruppi in Associazioni › Corsi e sedi, provare un invito (il backend corregge un difetto che impediva di trovarli) e una richiesta di promozione in staging con le email. I crediti partono spenti: si attivano in Associazioni › Crediti solo su decisione del Direttivo.

In modalità agente (`AGENT_MODE=true`) tutte le schermate funzionano senza backend: `AGENT_ASSOCIATION_ROLE` sceglie operatore, responsabile, collaboratore o account senza associazione; per i referenti usare anche `AGENT_PERMISSIONS=none`.
