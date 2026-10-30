# PRD — Admin Dashboard PoliNetwork

**Versione:** 3.0 · **Aggiornamento:** 30 ottobre 2026 · **Stato:** proposta di prodotto aggiornata per revisione.

Documenti: [classificazione e prossime attività](PRD_Classificazione_Feature.md), [MVP](MVP.md),
[People](Persone_Volontari_Soci.md), [permessi](RBAC_Ruoli_Permessi.md),
[design IdP](IdentityProvider_Design.md), [modello dati](IdentityProvider_DataModel.md),
[checklist sito](Checklist_Sito_Web.md).

## 0. Scopo e metodo

Dare al team una base attuale per decidere e assegnare il lavoro. Prima gli strumenti interni, poi i servizi
per soggetti esterni. Questa revisione sostituisce le ipotesi di agosto–ottobre, in particolare il registro
unico persone/soci/censimento e i collegamenti automatici delle identità.

**Presente in main** significa codice integrato, non deploy o collaudo certificato. **In PR** significa lavoro
non integrato. **Da progettare** significa che il requisito non è un contratto da implementare subito.
Le decisioni People del 29 ottobre in [admin#146](https://github.com/PoliNetworkOrg/admin/issues/146)
prevalgono sui vecchi documenti e sulle descrizioni delle PR #132/#136. Le fonti fissate sono in §20.

### 0.1 Stato attuale

- OIDC/BFF, permessi puntuali, shell, overview, Telegram, WhatsApp, etichette, report e CMS sono in main.
- eSign è integrato: richieste, firma CIE locale, più firmatari, posizioni e documenti, OneDrive e consegna email.
- People, soci, quote, ricevute e censimento sono entrati in main con #97/#100. Il backend espone `people.*`:
  non è più corretto descriverli come sole UI in PR o chiedere di implementare da zero il vecchio contratto.
  La roadmap #146 riporta però un'area vuota/non collegata a RBAC, con soli dati di test: serve il nuovo percorso sotto.
- Microsoft 365 crea soci e cambia il numero associativo; i gruppi e i loro membri sono in sola lettura (#133).
- Matricole è modificabile da admin (#124), e web legge il contenuto backend. Il lockfile admin risolve
  `@polinetwork/backend` 4.0.0, che include `web.freshman`: la nota README su 1.4.0 è storica.
- Il backend main rifiuta tutte le chiamate senza token (#97); web richiede il proprio token (#198).
  Non pianificare un rollback con `LEGACY_ANONYMOUS=allow`.

## 1. Persone, ruoli e gerarchie

Socio, Group Admin e membro di team sono categorie indipendenti. Essere admin di un gruppo Telegram non
costituisce la fonte dei ruoli organizzativi. Telegram collegato non è necessario per entrare nella dashboard.

La direzione approvata in #146 separa:

1. **People:** Group Admin, Capo Admin e membri/Lead dei team, collegati ai ruoli Auth.
2. **Soci:** utenti Entra ID, quote e rinnovi, separati dai record People.
3. **Censimento:** conferma periodica degli admin, costruita dopo la fase 1.

Una persona non collegata vive soltanto nel backend. Nessun utente preliminare in Auth, nessun matching
per nome, email o Telegram. Sono previsti solo invito accettato e collegamento manuale autorizzato.

## 2. Fondamenta

### 2.1 Autorizzazione

Implementata: `me.access`, permessi esatti, middleware BFF e controllo indipendente nel backend.
`/dashboard` ammette `admin:access` oppure `people:self`; quest'ultimo apre la vista limitata.
In main gli incarichi People vengono dalla scheda; il loro collegamento ai ruoli Auth è lavoro di fase 1.

Requisito fase 1: binding predeterminati `admin`, `capo`, `team:<key>:member`, `team:<key>:lead`.
Auth controlla delega, autorizzazione corrente e divieto di autoassegnazione. Ruoli con permessi `idp:*`
non sono associabili a People. Un Lead può gestire i membri del proprio team, senza promuovere Lead.
Il Capo Admin consulta i propri admin; la loro gestione resta futura.

### 2.2 Audit amministrativo

L'audit RBAC di Auth e quello di moderazione non sono un registro unificato già disponibile in admin.
Filone aperto: [auth#76](https://github.com/PoliNetworkOrg/auth/pull/76) registra `audit:read`,
[backend#90](https://github.com/PoliNetworkOrg/backend/pull/90) registra le mutazioni e offre `audit.list`,
[admin#123](https://github.com/PoliNetworkOrg/admin/pull/123) aggiunge la pagina.

Accettazione: ricerca e filtri per attore, oggetto, azione, esito e periodo; dettaglio prima/dopo dove raccolto;
sola lettura; nessun segreto o contenuto dei file nei log. Verificare la copertura degli eventi Auth:
il middleware backend da solo non dimostra che le modifiche avviate nell'IdP compaiano nella vista comune.

### 2.3 Ricerca

La palette ⌘K esiste: naviga alle sezioni e avvia ricerche tramite `?q=`. Una ricerca unica che restituisca
record di più domini resta futura; non ricostruire la palette per implementarla.

### 2.4 Overview

Conteggi, segnalazioni, grant e andamento della creazione utenti Telegram sono implementati secondo i permessi.
Quest'ultimo non misura utenti attivi o audience. Indicatori People/quote richiedono i nuovi domini stabili.

### 2.5 Consensi

Esistono UI e contratto People della prima iterazione, ma non certificano un processo definitivo di informative,
consensi versionati e retention. Il cleanup toglie i flussi collegati al censimento. Progettare il processo futuro
con testi, prova di accettazione, revoca e destinatari prima di collegarlo a eSign. Una firma PDF generica non
completa da sola il processo privacy.

### 2.6 Identity Provider

Auth è autonomo; admin è un consumer OIDC con sessioni Redis dedicate e token solo server-side.
Google/Entra, passkey, Telegram collegato e verifica studente vivono nell'IdP. Socio/Direttivo derivano da Entra.
Il sito usa credenziali di servizio per le letture: questo non è login personale dei visitatori.
Non ricostruire autenticazione o RBAC dentro admin.

### 2.7 eSign

La firma CIE passa dall'app locale: il PIN resta nella sua pagina, mai nel BFF. Da telefono/tablet si consulta;
la firma richiede computer e lettore. La dashboard non permette upload di un PDF firmato altrove nel flusso generico.
Riusare viewer, compositore, firma multipla e gestione drive. Il ponte ricevute People oggi presente sarà rimosso
nel cleanup; la sua eventuale reintroduzione è una decisione della fase Soci, non una dipendenza della fase 1.
Prima di dichiarare il servizio operativo, raccogliere evidenza di configurazione Graph/drive, permessi,
installazione dell'agent e firma con CIE reale sui sistemi supportati ([tracker](docs/esign/TRACKER.md)).

## 3. People: cleanup e fase 1

Il programma corrente è [#146](https://github.com/PoliNetworkOrg/admin/issues/146).
[Specifica dettagliata](Persone_Volontari_Soci.md).

- **Cleanup #142:** admin#147 implementa #138: soci, quote, ricevute e censimento restano mockup espliciti,
  senza backend e con azioni disabilitate. Vengono rimossi matching, gruppi Telegram e ponte ricevute/eSign.
  Distribuire prima di backend#104; poi rimuovere i permessi obsoleti secondo auth#77.
- **Fase 1 #143:** Auth#73 va rielaborata secondo auth#78 e nuovamente revisionata; segue configurazione auth#79.
  Backend#101 costruisce record, incarichi e sincronizzazione; #102 inviti/link; #103 import CSV.
  Admin#139/#140/#141 consumano quei contratti.
- **Non mergiare #132/#136 o backend#99 come soluzione finale:** #146 li supera; recuperare solo le parti richieste
  dalle nuove issue. Le revisioni People sono sospese finché le sottoissue non le riaprono.

Accettazione: record creato con soli nome/cognome; incarichi non collegati in attesa; dopo il link Auth applica
oppure rifiuta con motivo; la UI distingue attesa dal successo. Invito utilizzabile anche da un account
senza permessi dashboard, su una pagina esterna alla shell protetta. Nessuna assegnazione a sé stessi.

## 4. Governance e Direttivo

Nessuna nuova area separata impegnata in questo ciclo. Auth gestisce ruoli e permessi; lo stato associativo
proviene da Entra. Storico degli organi e contenuti pubblici non vanno dedotti dai record People.

## 5. Admin e Capo Admin

Le pagine esistono in main, ma hanno residui del vecchio modello Telegram. Il cleanup li rimuove;
admin#139 le ricostruisce sui ruoli Auth e sulla relazione «Capo di riferimento».
Il corso personale non determina automaticamente l'ambito di responsabilità. La vista del Capo deve escludere
admin altrui anche chiamando direttamente il backend; approvare ingressi nei gruppi non è nella fase 1.

## 6. Soci, quote e ricevute

[Fase 2 #144](https://github.com/PoliNetworkOrg/admin/issues/144): non iniziata, design necessario.
Entra ID è fonte dei soci, object ID chiave del dominio quote e `employeeId` numero associativo.
Nessuna condivisione con People o claim del record socio. L'ammissione resta nel workflow Azure esistente.

Bonifico esterno, caricamento prova, revisione, ricevuta numerata, firma CIE e reminder sono bisogni da
riesaminare usando #100 come riferimento storico. Definire annualità, importi, numerazione, firmatari,
annullamento, destinatari e permessi prima di ricostruirli. `soci:*` è un namespace proposto, non un catalogo già attivo.

## 7. Team

UI team e vista Lead sono in main; sincronizzazione dei ruoli Auth e stati degli incarichi sono nella fase 1.
Chiavi previste: `it`, `hr`, `design`, `intl`, `events`, da validare contro i binding Auth.
Un team senza binding non è assegnabile. Il nome «Design & Marketing» è un riuso richiesto da #139.
I tool specifici dei team non sono parte del primo rilascio.

## 8. Censimento e onboarding

[Fase 3 #145](https://github.com/PoliNetworkOrg/admin/issues/145): design necessario dopo la fase 1.
Chiede ai Group Admin se continuano; chi non è collegato riceve prima un invito. L'uscita usa lo stesso
comando di revoca ruolo della fase 1. Il vecchio wizard Forms non è il contratto futuro.
Candidature, colloqui HR, richieste ai gruppi e firma dei documenti restano processi da definire separatamente.

## 9. Email di compleanno

Backlog, dopo il design Soci: richiede uno scopo per la raccolta della data, destinatari e regole di invio.
Non è motivo per aggiungere dati di nascita alla fase 1 People.

## 10. FAQ

CRUD bilingue e categorie sono presenti. Matricole seleziona cinque FAQ dal catalogo.
Import da file e popolamento editoriale restano da fare; riordino e bozza/pubblicazione sono estensioni
future da validare anche sul contratto backend, non blocchi automatici del lancio.

## 11. Aree operative e CMS

- **Telegram/WhatsApp:** gruppi, visibilità, etichette e pubblicazione sono presenti. Telegram non crea gruppi
  dalla dashboard. Grant attivi/programmati esistono; storico completo e reminder restano backlog.
- **Microsoft 365:** directory (`azure:members:read`), nuovo socio (`azure:members:create`), cambio numero
  (`azure:members:write`, conferma e email opzionale). Il backend rifiuta numeri occupati e richiede un token utente
  per il cambio. Gruppi (`azure:groups:read`) sempre in sola lettura: Soci determina ruoli IdP.
  Modifiche generiche a utenti, licenze o membership non sono il prossimo incremento autorizzato.
- **Matricole:** risorse, hub Telegram, cinque FAQ e tab Guida; vecchio URL guide rediretto.
  Titoli/struttura restano fissi. Verificare il ciclo admin → backend → web con dati effettivi.
- **Progetti/associazioni:** CRUD interno disponibile. Risorse per piattaforma: backend#72 ancora aperta,
  poi servono editor admin e lettura web. Non confondere questo con il singolo link progetto esistente.

## 12. Associazioni partner

Backlog dopo il lavoro interno: referenti multipli, ownership dell'organizzazione, richieste di creazione/modifica,
approvazione editoriale e pubblicazioni sui canali. Il CRUD interno non offre accesso esterno scoped.
Definire isolamento dei record e successione dei referenti, senza trasferire account personali.
Canali (Telegram/WhatsApp), crediti e responsabilità di approvazione restano da concordare.

## 13. Eventi / PoliTamTam

Backlog: inserimento da partner o PoliNetwork e approvazione prima della pubblicazione.
Dipende dal design di ownership e revisione dei contenuti; non è parte del MVP interno.

## 14. Aziende

Da progettare con un referente di prodotto; nessun incremento assegnabile finché manca lo scope.

## 15. Casa e coinquilini

Backlog esterno: definire identità degli inserzionisti, moderazione e ciclo di vita degli annunci.

## 16. Newsletter

Backlog: segmenti, consensi, disiscrizione e invio. Non usare automaticamente contatti People come mailing list.

## 17. Vincoli e verifica

Permessi puntuali su UI/BFF/backend, dati personali limitati allo scopo, nessun token nel client.
Le mutazioni ricaricano i loader prima di chiudere/toast; errore di reload dopo salvataggio non invita a ripetere.
Nessuna azione distruttiva su più righe senza istruzione esplicita dell'utente (AGENTS.md).
La cancellazione dei dati di test pianificata dal cleanup è lavoro della PR backend, non di questi documenti.

Agent mode non prova autenticazione o accesso al backend reale: People usa il fake; gli altri domini possono
ricevere `UNAUTHORIZED` dal backend main. Per integrazioni usare staging con token reali e fixture isolate.
Verificare anche ruoli limitati, desktop/mobile e failure di Auth, non solo l'account con tutti i permessi.
UI admin prevalentemente inglese; localizzazione IT/EN resta un requisito futuro distinto dai contenuti bilingui.

## 18. Fuori scope del ciclo

Contabilità completa, gateway pagamenti, modifica dello statuto, gestione libera dei gruppi Entra e migrazione
dei dati People di test. MCP admin è un filone separato in [#137](https://github.com/PoliNetworkOrg/admin/pull/137):
OAuth personale e permessi correnti, ancora da integrare e attivare; la firma richiede comunque la persona.

## 19. Decisioni residue e prossimo ordine

1. Completare e distribuire il cleanup nell'ordine #142; verificare che i mockup non facciano chiamate.
2. Stabilizzare binding/delega e provisioning Auth (#78/#79), poi tipi backend e pagine fase 1.
3. Collaudare inviti senza permessi, link/unlink, revoche, attori e comandi idempotenti.
4. Portare avanti audit (#76/#90/#123) e collaudo Matricole come filoni separati.
5. Definire design Soci (#144) e censimento (#145), senza ripristinare il vecchio dominio unificato.
6. Decidere retention, visibilità dei contatti, processo consensi, candidatura HR e localizzazione.
7. Concordare scope partner/eventi, newsletter e casa solo dopo le priorità interne.

Non riaprire come decisioni tecniche il metodo di login, il matching automatico o la fonte dei soci:
sono già fissati rispettivamente dal BFF e dalla roadmap #146.

## 20. Fonti della revisione

Snapshot consultato il **30 ottobre 2026**; stato delle PR distinto dal loro eventuale deploy.

| Fonte                                                                                                                                                                                                                                                                         | Baseline / uso                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [admin main c4b5abf](https://github.com/PoliNetworkOrg/admin/tree/c4b5abfe8078d2fcecb958924d162278b7b26dd6)                                                                                                                                                                   | Codice, route, permessi, lockfile, test; #97/#100/#124/#130/#133/#134/#135 integrati |
| [backend main 1c9f937](https://github.com/PoliNetworkOrg/backend/tree/1c9f937e77866a59d950dd28384c2f435016f494)                                                                                                                                                               | README autenticazione, policy e `src/people/router.ts`; chiamate anonime eliminate   |
| [auth main 720e8bc](https://github.com/PoliNetworkOrg/auth/tree/720e8bcf36f696cc819e952bbe6365e6b9fd119a)                                                                                                                                                                     | README, schema RBAC; MCP Auth integrato, binding People ancora in PR                 |
| [web main 0e04231](https://github.com/PoliNetworkOrg/web/tree/0e042311a3b21e442b14ebd2d3d769d84cc55762)                                                                                                                                                                       | README, client backend e pagina Matricole; token di servizio obbligatorio            |
| [Roadmap People #146](https://github.com/PoliNetworkOrg/admin/issues/146)                                                                                                                                                                                                     | Decisioni del 29 ottobre e precedenza sui vecchi piani                               |
| [Cleanup #142](https://github.com/PoliNetworkOrg/admin/issues/142), [fase 1 #143](https://github.com/PoliNetworkOrg/admin/issues/143), [Soci #144](https://github.com/PoliNetworkOrg/admin/issues/144), [censimento #145](https://github.com/PoliNetworkOrg/admin/issues/145) | Ordine, sottoissue e criteri di accettazione                                         |

Consultate le PR aperte di admin, auth, backend e web; inventario operativo nella classificazione.
I documenti `docs/people/*` descrivono la prima implementazione: usarli per leggere main, non per contraddire #146.
I vecchi SHA di bot, polinet.cc, aule, slide e altri progetti non sono una verifica aggiornata di quei repository.
Questa PR aggiorna documenti e incorpora main per verificarli sul codice attuale; non distribuisce servizi.
