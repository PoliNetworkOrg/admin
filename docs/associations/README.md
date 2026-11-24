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

## Stati e gestione dei referenti

Le richieste passano per bozza, invio, eventuali integrazioni, approvazione/rifiuto o ritiro. Le modifiche inviate restano separate dalla versione pubblicata, anche durante un rifiuto. La scheda richiede entrambe le descrizioni per essere pubblicata.

Gli inviti scadono dopo 14 giorni, sono monouso e sono invalidati dal ritiro. Ogni nuovo collegamento e ogni cambio di ruolo richiede approvazione. La rimozione ordinaria dell'ultimo responsabile richiede prima un sostituto; l'abbandono personale o una revoca esplicita PoliNetwork sono immediati e lasciano il record segnalato come privo di responsabile.

La sospensione blocca le modifiche dei referenti e può mantenere visibile la scheda; l'oscuramento la rimuove dal sito. L'archiviazione conserva registro e storico, blocca la gestione e oscura la scheda. Le note interne sono visibili solo agli operatori. Ogni richiedente vede soltanto le proprie evidenze; i referenti vedono anche le proposte di contenuto della propria associazione.

## Contratto e rilascio

Il backend espone `associationPortal.*`. Il BFF valida tutte le risposte con `portal.contract.ts`, copia del contratto backend. Login OIDC, sessioni Redis e controllo Origin restano quelli esistenti. L'accesso alla shell è aperto agli account autenticati con una risposta fresca di `me.access`; i singoli servizi interni continuano a richiedere i propri permessi.

Il backend conserva registro, richieste, storico e collegamenti in un aggregato transazionale PostgreSQL. Revisioni ottimistiche, blocchi di riga e chiavi di idempotenza proteggono da approvazioni concorrenti e retry. Le email usano una coda durevole con retry; lo stato è consultabile anche nel portale. Nessuna modifica deve essere ripetuta solo perché il successivo aggiornamento della pagina fallisce.

Le tre PR vanno coordinate: migrazione e backend, poi admin; il sito supporta sia la vecchia risposta sia `extraLinks`. Durante il breve intervallo tra backend e admin, il vecchio editor rifiuta le scritture. La migrazione conserva identificativi e schede pubbliche esistenti, senza assegnare referenti. Verificare `ESIGN_DASHBOARD_URL=https://admin.polinetwork.org`, configurazione email e storage Azure del backend. Non sono richieste nuove autorizzazioni globali nel repository Auth.

Il rilascio richiede backup e normale procedura di migrazione del backend. Queste PR non eseguono migrazioni né deployment in produzione. Dopo il rilascio verificare login reale, consegna invito via email e caricamento logo contro i servizi configurati; la prova automatizzata locale usa account e recapiti fittizi.
