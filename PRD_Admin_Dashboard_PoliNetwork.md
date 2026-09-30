# PRD — Admin Dashboard PoliNetwork

**Documento di prodotto per il Team IT**
**Versione:** 2.1
**Data:** 30 settembre 2026
**Stato:** Bozza per revisione

**Documenti di dettaglio:** [`PRD_Classificazione_Feature.md`](./PRD_Classificazione_Feature.md) (priorità e dipendenze) · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md) (capacità e ruoli) · [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) (Identity Provider) · [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md) (tabelle e contratti)

## 0. Scopo

Documento di riferimento per le funzionalità della Admin Dashboard di PoliNetwork. Le funzionalità interne (anagrafica soci, censimento admin/team, ruoli, governance, team) hanno priorità sulle aree pensate per soggetti esterni (associazioni partner, aziende, alloggi).

---

## 1. Persone, ruoli e gerarchie

### 1.1 Ruoli Telegram

Il backend Telegram conosce sei ruoli: `admin`, `hr`, `president`, `direttivo`, `creator`, `owner`.

| Ruolo | Accesso dashboard | Scrittura dashboard |
|---|---|---|
| `owner` | sì | sì |
| `direttivo` | sì | sì |
| `president` | sì | sì |
| `hr` | sì | no — sola lettura |
| `admin` | da estendere (§1.3) | no |
| `creator` | no, escluso esplicitamente anche se combinato con altri ruoli | no |

I permessi sono binari e globali per ruolo: non esiste granularità per modulo/azione né scoping (es. "vede solo gli admin del proprio corso"). Va introdotta un'autorizzazione per capacità (§2.1) che estenda questo modello senza sostituirlo. Oggi il codice richiede inoltre un Telegram collegato per entrare in dashboard; il design dell'Identity Provider (§2.6) rimuove questo vincolo.

### 1.2 Socio, Admin e membro di team — categorie indipendenti

Socio, Admin e membro di un team interno (IT, Design & Social, International, HR, Events & Partnerships, ...) sono **tre categorie indipendenti**, non una gerarchia annidata:

- **Socio**: chi risulta iscritto e in regola con la quota associativa (Anagrafica Soci, §3).
- **Admin**: chi ha un ruolo operativo/organizzativo su PoliNetwork.
- **Membro di team**: chi fa parte di un team interno (§7).

Un admin può essere socio o no; un socio può essere admin o no; un membro di un team può essere admin, socio, entrambi o nessuno dei due: le tre categorie si intersecano liberamente e nessuna implica le altre. **Il Socio resta la categoria più rilevante per l'associazione**: è chi la costituisce formalmente. Admin e membro di team sono categorie organizzative/operative e non sostituiscono né presuppongono lo status di socio.

- Un **Socio** è un record dell'Anagrafica Soci (§3), indipendente dall'essere admin o membro di team.
- Un **Admin** è una persona con un ruolo organizzativo (Admin, Capo Admin, Direttivo, Presidente, ...) tracciato dal Censimento Admin/Team (§3), con un'identità Telegram collegata se opera sui canali PoliNetwork. Non deve necessariamente essere anche Socio.
- Un **Capo Admin** è un Admin con uno scope aggiuntivo (es. corso di studi) e visibilità limitata al proprio ambito.

### 1.3 Gerarchia organizzativa

```
Owner / Presidente / Direttivo   — governance, accesso e scrittura completi
        │
   Capo Admin (per corso/ambito) — visibilità e azioni limitate al proprio ambito
        │
      Admin                       — operativo
```

Lo status di Socio e l'appartenenza a un team interno sono assi indipendenti (§1.2): possono coesistere con qualunque punto della gerarchia sopra, o con nessuno.

Il Direttivo assegna e revoca il ruolo di Capo Admin (periodicità da definire). L'admin "semplice" deve ottenere accesso alla dashboard, con permessi determinati dal proprio scope. Resta da decidere se "Capo Admin" sia un nuovo ruolo Telegram/backend o un attributo applicativo (scope) gestito solo lato dashboard (§19).

Una persona admin appartiene a **un solo corso di studi** come dato anagrafico personale, ma può essere admin/Capo Admin con **scope su gruppi di corsi diversi** contemporaneamente: il corso di appartenenza personale e lo scope di responsabilità sono due campi distinti.

---

## 2. Fondamenta

### 2.1 Autorizzazione per capacità (RBAC granulare)

Permessi indipendenti per modulo: lettura/scrittura su soci, Telegram, Azure, contenuti, governance, audit. Un utente può avere più capacità (es. Content editor + Telegram moderator). Le azioni ad alto impatto (cancellazioni, assegnazione ruoli, rimozione da gruppi, export dati personali) mostrano il permesso richiesto e richiedono conferma esplicita. Resta retrocompatibile con i ruoli Telegram esistenti, che diventano un caso particolare del nuovo modello. Catalogo delle capacità, ruoli preset (gerarchia e funzionali) e regole di scoping sono in [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md); il modello dati è in [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md).

### 2.2 Audit amministrativo unificato

Ogni mutazione amministrativa produce una voce di audit con: attore, ruolo al momento dell'azione, timestamp, oggetto modificato, valori prima/dopo, motivo (obbligatorio per azioni sensibili), esito. Precondizione per esporre dati personali dell'Anagrafica/Censimento a più ruoli.

### 2.3 Ricerca globale

Command palette che cerca trasversalmente soci, utenti Telegram, gruppi, membri Azure, FAQ e contenuti.

### 2.4 Home come centro operativo

Indicatori azionabili: soci in scadenza, account non riconciliati, grant in scadenza, contenuti da pubblicare, attività recenti. Ogni indicatore è cliccabile e apre la lista filtrata corrispondente.

### 2.5 Gestione dei consensi e firma della privacy policy in dashboard

Oggi le autorizzazioni privacy vengono raccolte tramite vari form esterni inviati caso per caso: le domande possono cambiare o diventare obsolete nel tempo, e la perdita di un form comporta la perdita della possibilità di dimostrare/recuperare il consenso raccolto con quella versione.

- La firma della privacy policy (e di altre informative) avviene **dentro il flusso della dashboard** (iscrizione socio, §3.1; onboarding/censimento admin, §8), non più solo tramite form esterni scollegati.
- Ogni consenso è legato a una **versione specifica del testo firmato**, con data e revoca tracciabili: un cambiamento futuro del testo non invalida né sovrascrive lo storico dei consensi già raccolti.
- La firma passa per l'audit unificato (§2.2).
- Richiede l'Identity Provider (§2.6) per autenticare con certezza chi sta firmando.

### 2.6 Identity Provider PoliNetwork

Identity/authentication provider proprio di PoliNetwork, distinto dal login attuale, come punto di ingresso unico per i flussi self-service:

- autenticazione preventiva obbligatoria prima di qualunque flusso di censimento/onboarding (§8), firma documenti (§2.5) o consultazione delle proprie statistiche/riferimenti (es. Capo Admin di riferimento);
- base per assegnare permessi differenziati in base a cosa la persona fa/è in PoliNetwork — ogni persona ha comunque un livello minimo di accesso alle proprie informazioni;
- precondizione per un futuro accesso esterno multi-tenant (associazioni partner, §12).

Design in [`IdentityProvider_Design.md`](./IdentityProvider_Design.md). In sintesi: il login resta email OTP/passkey su Better Auth, per chiunque (anche dal sito pubblico); Telegram, affiliazione Politecnico (`@mail.polimi.it`/`@polimi.it`, codice via email) e record Socio (claim via codice) sono tre collegamenti indipendenti sulla stessa identità; l'autorizzazione non dipende più da Telegram; l'identità viene esposta agli altri servizi (sito pubblico, polinet.cc, futuri) tramite OIDC.

---

## 3. Anagrafica Soci e Censimento Admin/Team

Due registri distinti, coerenti con l'indipendenza delle categorie di §1.2:

- **Anagrafica Soci**: registro dei **soci attivi e paganti**, con **storico** dei soci passati. Per un socio l'azione ricorrente è il **rinnovo della quota associativa** (§6), non una rilevazione periodica di interesse.
- **Censimento Admin/Team**: rilevazione rivolta ad **admin e membri dei team**, il cui scopo è **rinnovare l'interesse/la disponibilità** a continuare il proprio ruolo — non una quota. Si integra con l'Onboarding (§8).

Una persona può comparire in entrambi, in uno solo, o in nessuno dei due.

### 3.1 Anagrafica Soci — campi

| Blocco | Campi | Note |
|---|---|---|
| Identità | nome, cognome, email, telefono (opzionale) | |
| Identificativo | ID interno, numero associativo univoco | proprietà di questo registro (database PoliNetwork); Azure lo referenzia se presente |
| Stato | attivo pagante, sospeso, scaduto, ex socio | |
| Iscrizione | data ingresso, anno associativo (iscrizione annuale), data scadenza, stato rinnovo | |
| Profilo associativo | corso di studi, anno di corso, sede, competenze/interessi (opzionali) | |
| Consensi | consenso privacy policy, fonte, data, versione firmata, revoca | firma diretta in dashboard, §2.5 |

Alcuni campi sono obbligatori, altri opzionali (l'elenco puntuale, incluso se serva il codice fiscale, resta da definire). HR può leggere l'Anagrafica Soci; il dettaglio dei permessi granulari campo per campo resta da definire.

Vincoli: numero associativo univoco; storicizzazione degli stati (non sovrascrittura: i soci scaduti/ex soci restano nello storico); nessuna cancellazione bulk senza anteprima e conferma; ogni lettura/scrittura sensibile passa per l'audit (§2.2).

Flusso: richiesta/iscrizione → verifica dati → deduplica → firma privacy policy → approvazione → numero socio → invio del codice di claim all'email di iscrizione (il socio lo usa per collegare il tesseramento alla propria identità, §2.6) → collegamento opzionale a Telegram/Azure → rinnovo annuale della quota (§6) → storico.

### 3.2 Censimento Admin/Team — campi

Rivolto a chi ha un ruolo organizzativo (Admin, Capo Admin, Direttivo, membro di team), indipendentemente dall'essere anche Socio.

| Blocco | Campi | Note |
|---|---|---|
| Identità | nome, cognome, email, telefono | |
| Relazioni | ruolo organizzativo (§1.3), team (§7), Capo Admin/responsabile di riferimento | |
| Integrazioni | Telegram ID/username, Azure user ID, ultimo sync | collega senza duplicare |
| Rinnovo interesse | data ultima conferma, prossima scadenza conferma, esito | sostituisce il concetto di "quota" per questa popolazione |
| Consensi | consenso privacy policy, fonte, data, versione firmata | §2.5 |

Flusso: rilevazione periodica (periodicità da definire, es. legata all'anno accademico) → conferma interesse/disponibilità tramite il flusso di Onboarding/Censimento in dashboard (§8) → aggiornamento stato → storico.

### 3.3 Permessi

Creazione/modifica: ruoli con `members.write` (Direttivo/Owner/President inizialmente). Lettura: `members.read`, assegnabile anche a HR in sola lettura. Un operatore può creare un socio o un record del Censimento Admin/Team senza dover prima creare un account Azure.

---

## 4. Governance e Direttivo

Non verrà realizzata come area dedicata separata. La composizione del Direttivo, il ruolo organizzativo e l'incarico sono coperti dal Censimento Admin/Team (§3.2) e dalla gerarchia ruoli (§1.3).

---

## 5. Dashboard Admin e Capo Admin

- Vista Capo Admin: elenco degli admin del proprio corso di studi con nome, cognome, anno di corso, data di ingresso, flag rappresentante, altre associazioni di appartenenza, telefono, username/contatto Telegram, link rapido WhatsApp/Telegram.
- Filtri: nome/cognome, anno, rappresentanza, altre associazioni.
- Sezione link ai gruppi Telegram di competenza del Capo Admin.
- Permessi: il Capo Admin vede **solo** i dati e i gruppi del proprio ambito (scoping, §2.1).

Il modello dati separa il corso personale (Censimento Admin/Team, §3.2) dallo/dagli scope assegnati come Capo Admin (§1.3).

---

## 6. Gestione Soci e Rinnovi

Il pagamento della quota resta un **bonifico bancario fuori dashboard**; il flusso di verifica del pagamento è in-dashboard:

- Il socio può caricare la ricevuta del bonifico in dashboard; il caricamento avvia una richiesta di approvazione.
- Il Direttivo/ruolo autorizzato approva la ricevuta caricata, oppure segna il rinnovo come effettuato manualmente se la ricevuta non viene caricata.
- **Ricevuta automatizzata**: quando un rinnovo viene approvato, la dashboard genera e invia automaticamente la ricevuta al socio.
- Per i rinnovi del Direttivo verso l'associazione stessa, la ricevuta viene generata/automatizzata allo stesso modo; quando è richiesta una firma, il flusso notifica il Presidente, che deve firmarla.
- Reminder via email poco prima della scadenza.
- Vista Direttivo sullo stato dei soci: da verificare, ricevuta caricata in attesa di approvazione, pagamento effettuato, pagamento non effettuato.
- Azioni: "Approva ricevuta"/"Segna come pagato" (aggiorna stato + genera ricevuta + email di conferma), "Invia reminder".
- Storico delle azioni (chi ha approvato/segnato pagato, reminder inviati, ricevute generate), tracciato nell'audit (§2.2).
- Resta da decidere se il permesso di segnare come pagato/approvare ricevute sia riservato al solo Direttivo o esteso a un futuro ruolo Finance dedicato.

---

## 7. Aree Team interni

Ogni team (IT, Design & Social, International, HR, Events & Partnerships, ...) è un'entità del Censimento Admin/Team (§3.2, blocco "Relazioni"), con pagina/area indipendente e permesso dedicato (§2.1). Obiettivo iniziale: struttura, ruoli e separazione degli accessi, non le funzionalità specifiche di ciascun team.

---

## 8. Onboarding e Censimento Admin — flusso self-service in dashboard

Sia il censimento di nuovi candidati admin, sia il censimento periodico di admin già attivi, avvengono tramite un **flusso automatizzato della dashboard**, attivabile tramite un link o una mail inviata alla persona — non più tramite Telegram e scambio di messaggi manuale.

- Autenticazione preventiva obbligatoria sull'Identity Provider PoliNetwork (§2.6) prima di poter proseguire nel flusso — identifica la persona e determina il tipo di candidatura/censimento applicabile.
- Una volta autenticato, l'utente accede a un'area personale dove può: firmare i documenti richiesti (§2.5), consultare le proprie statistiche, vedere il proprio Capo Admin di riferimento.
- Permessi differenziati per ruolo: ogni membro di PoliNetwork ha un livello di accesso diverso in base a cosa fa/è, ma tutti hanno accesso a qualcosa nella propria area.
- Richieste che risalgono la gerarchia: un admin può presentare dalla propria area la richiesta di diventare admin di un determinato gruppo, e la richiesta arriva al proprio Capo Admin di riferimento per l'approvazione.

Ambito: link/mail di attivazione → autenticazione (Identity Provider) → candidatura o conferma censimento periodico → firma documenti → colloquio/approvazione (per i nuovi) → creazione/aggiornamento profilo (Censimento Admin/Team) → assegnazione corso/ruoli/team → passaggi di ingresso operativo. Il dettaglio del processo (candidatura, colloquio, criteri) resta da definire con HR e Team IT.

---

## 9. Email di compleanno

Riguarda solo i soci. Dipende dall'Anagrafica Soci (data di nascita) e da un motore email.

---

## 10. FAQ pubbliche

Categorie e CRUD FAQ bilingue IT/EN, ricerca, riordino drag&drop, stato bozza/pubblicata.

---

## 11. Miglioramenti alle aree esistenti

- **Telegram grants**: storico dei grant terminati/interrotti; reminder sulle scadenze imminenti.
- **Telegram groups**: creazione/import di gruppi dalla dashboard, indicatori di salute (gruppo senza owner, invito rotto), statistiche.
- **Azure**: gestione licenze dalla UI; access review periodico sui gruppi.
- **Guide**: workflow bozza/pubblicazione, anteprima PDF, storico versioni invece di sola sostituzione.

---

## 12. Area Associazioni Partner

- Accesso e gestione account per decine di associazioni: si può creare l'account a **uno o più referenti** della stessa associazione fin dal MVP, e i referenti possono **nominare un successore trasferendo l'ownership** del proprio account.
- Richieste di pubblicazione nei gruppi Telegram: le associazioni presentano la richiesta dalla propria pagina/area e PoliNetwork approva. Le richieste possono riguardare più gruppi contemporaneamente; la dashboard mostra già l'elenco completo dei gruppi tra cui scegliere. Resta da chiarire se serva anche l'integrazione WhatsApp.
- Gestione della pagina pubblica dell'associazione con flusso di richiesta/approvazione, al posto dell'attuale CRUD diretto di PoliNetwork.
- Eventuale sistema a crediti: logica ancora non definita.
- Eventi delle associazioni / "PoliTamTam" (§13).

Richiede l'Identity Provider PoliNetwork (§2.6) per l'accesso esterno multi-tenant.

---

## 13. Eventi delle associazioni — PoliTamTam

Le associazioni partner inseriscono gli eventi dalla propria pagina/area; PoliNetwork può inoltre aggiungere propri eventi, o eventualmente eventi per conto di altre associazioni. Ogni evento richiede approvazione prima di comparire pubblicamente — nessuna pubblicazione diretta.

---

## 14. Area Aziende

Da progettare in dettaglio prima dello sviluppo.

---

## 15. Area proprietari di casa / Bacheca casa e coinquilini

Riguarda esclusivamente soggetti esterni (proprietari, cercatori di stanza).

---

## 16. Newsletter

Dipende dall'Anagrafica Soci (segmentazione destinatari) ed eventualmente dagli eventi (§13) come fonte di contenuti.

---

## 17. Vincoli

- Nessuna azione distruttiva su più righe senza anteprima e conferma esplicita.
- Minimizzazione dei dati: ogni campo su soci/admin ha uno scopo dichiarato, un responsabile e un'ipotesi di retention; dati sensibili (es. codice fiscale) solo se realmente necessari.
- Audit prima di esporre dati personali a più ruoli.
- Interfaccia amministrativa bilingue IT/EN con preferenza impostabile per singolo utente.

---

## 18. Fuori scope

- Non ridefinisce lo statuto, gli organi sociali o le regole di voto dell'associazione.
- Non decide se e come integrare un gateway di pagamento (Stripe, altro): il pagamento resta un bonifico bancario eseguito fuori dashboard. È invece in scope la verifica del pagamento in dashboard (upload ricevuta, approvazione, ricevuta automatizzata, §6).
- Non propone una contabilità completa (fatture, bilanci).

---

## 19. Decisioni aperte

**§1 — Ruoli e gerarchie**
1. Il ruolo "Capo Admin" va modellato come nuovo ruolo Telegram/backend, o come attributo applicativo (scope) sopra il ruolo `admin` esistente, gestito solo lato dashboard? — da decidere. Il modello RBAC proposto lo tratta come preset di capacità con scope (`capability_grant`, `scopeType` corso), cioè lato dashboard: da confermare.
2. Con quale periodicità viene rinnovato il ruolo di Capo Admin (es. legato all'anno accademico)?

**§2 — Fondamenta**
3. Il nuovo Identity Provider PoliNetwork (§2.6) sostituisce integralmente l'attuale autenticazione, o si affianca ad essa come livello applicativo sopra le identità Telegram/Azure esistenti? — il design propone di estendere l'istanza Better Auth già in uso (login invariato, Telegram non più obbligatorio, OIDC sopra): da confermare.
4. Il consenso privacy raccolto in dashboard (§2.5) sostituisce integralmente i form esterni oggi in uso, o convive con essi durante una fase di transizione?

**§3 — Anagrafica Soci e Censimento Admin/Team**
5. Quali dati sono realmente necessari per il tesseramento (es. il codice fiscale è richiesto o va escluso)?
6. Un ruolo HR read-only può leggere tutti i campi del socio, o alcuni campi (es. dati di contatto personali) devono essere mascherati anche per HR?
7. Con quale periodicità si svolge il Censimento Admin/Team — es. una volta per anno accademico, o legato a un altro evento?

**§5 — Dashboard Admin e Capo Admin**
8. Come si definisce "corso di studi" nel sistema (elenco chiuso dei corsi del Politecnico, testo libero, altro)?

**§6 — Gestione Soci e Rinnovi**
9. Chi ha il permesso di segnare come pagato/approvare ricevute: solo Direttivo, o anche un ruolo Finance dedicato non ancora esistente?

**§8 — Onboarding e Censimento Admin**
10. Il processo di candidatura/colloquio va definito nel dettaglio con HR e Team IT (criteri, colloquio, tempistiche).

**§12 — Area Associazioni Partner**
11. Le richieste di pubblicazione riguardano solo Telegram, o resta necessaria anche l'integrazione WhatsApp?
12. Il sistema a crediti per le pubblicazioni resta previsto, e con quale logica di ricarica/consumo?

**Identity Provider** (da [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) §7)
13. Il codice di claim del tesseramento viene generato in automatico all'approvazione dell'iscrizione, o con un'azione manuale di chi approva?
14. Se l'email di iscrizione è diversa da quella dell'identità PoliNetwork, è permesso re-inviare il codice a un nuovo indirizzo, e chi lo autorizza?
15. Chi assegna le prime `capability_grant` dirette, e con quale processo (one-off di migrazione o richiesta via Onboarding, §8)?
16. Il plugin `oidcProvider` di Better Auth è compatibile con la versione installata (1.5.5) per registrazione client, consenso e maturità?
17. Il sito pubblico è il primo consumer dell'OIDC provider: va definito con chi lavora al sito l'ordine reale rispetto a polinet.cc.
18. Se estendere l'allowlist dei domini istituzionali oltre `@mail.polimi.it` e `@polimi.it` (la lista resta configurabile).
