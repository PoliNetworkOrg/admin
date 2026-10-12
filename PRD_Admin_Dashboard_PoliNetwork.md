# PRD — Admin Dashboard PoliNetwork

**Documento di prodotto per il Team IT**
**Versione:** 2.2
**Data:** 12 ottobre 2026
**Stato:** Bozza per revisione, allineata al codice integrato al 12 ottobre 2026

**Documenti di dettaglio:** [`PRD_Classificazione_Feature.md`](./PRD_Classificazione_Feature.md) (priorità e dipendenze) · [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md) (capacità e ruoli) · [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) (Identity Provider) · [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md) (tabelle e contratti)

## 0. Scopo

Documento di riferimento per le funzionalità della Admin Dashboard di PoliNetwork. Le funzionalità interne (anagrafica soci, censimento admin/team, ruoli, governance, team) hanno priorità sulle aree pensate per soggetti esterni (associazioni partner, aziende, alloggi).

### 0.1 Stato verificato e confini della verifica

La baseline è il codice dei branch remoti predefiniti dopo `git fetch --all --prune`, non i checkout locali o i branch di feature. «Implementato» significa presente nel codice integrato: questa revisione non certifica deploy, configurazione dei client, migrazione dei dati o collaudo in produzione. Le fonti e gli SHA verificati sono in §20.

- **Implementato:** IdP autonomo in `auth`, collegamenti di identità, eRBACo globale, directory utenti IdP, amministrazione applicazioni OAuth/OIDC, login OIDC/BFF della dashboard e controlli per procedura nel backend.
- **Implementato con transizione ancora prevista:** token di servizio per sito e bot, snapshot di autorizzazione, audit degli attori IdP e grant v2. Nel codice restano compatibilità anonima configurabile, modalità shadow/enforce del bot e dati/API legacy; non si assume concluso il cutover delle fasi 5–6 della RFC.
- **Implementato in admin:** overview con conteggi e andamento della creazione degli utenti Telegram, gestione Telegram/WhatsApp, contenuti (FAQ, guide, progetti, associazioni, etichette), segnalazioni link, directory Microsoft 365 e membership dei gruppi con permessi separati.
- **Roadmap residua:** Anagrafica Soci indipendente da Entra, Censimento Admin/Team, rinnovi, firma privacy e consensi versionati, scope corso/team, area Capo Admin e onboarding associativo; inoltre ricerca globale e audit amministrativo unificato.

La directory Microsoft 365 e il ruolo IdP `socio` derivato da Entra **non costituiscono** il registro associativo paganti/storico richiesto da §3.1. Il sito usa un token di servizio verso il backend: questo non equivale a un login personale degli studenti sul sito.

---

## 1. Persone, ruoli e gerarchie

### 1.1 Ruoli Telegram

I ruoli Telegram legacy (`admin`, `hr`, `president`, `direttivo`, `creator`, `owner` e `web` nell'inventario della RFC) servono alla riconciliazione della migrazione; non sono più il contratto di accesso della dashboard migrata.

L'accesso richiede `admin:access`; ogni lettura riservata o mutazione richiede il proprio permesso IdP, verificato anche dal backend. Telegram non è obbligatorio per accedere. I vecchi titolari vanno riconciliati con ruoli e permessi IdP, senza assegnazioni automatiche basate sul nome legacy.

L'IdP implementa i ruoli gestiti `master-admin`, `socio`, `direttivo`, `student`, oltre a ruoli personalizzati. `master-admin` ha tutti i permessi; gli altri ruoli hanno i permessi configurati. Il vecchio veto globale `creator` è sostituito dall'assenza dei permessi pertinenti, non da un'esclusione incondizionata. Dettagli in [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md).

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
Owner / Presidente / Direttivo   — responsabilità organizzative (permessi IdP espliciti)
        │
   Capo Admin (per corso/ambito) — visibilità e azioni limitate al proprio ambito
        │
      Admin                       — operativo
```

Lo status di Socio e l'appartenenza a un team interno sono assi indipendenti (§1.2): possono coesistere con qualunque punto della gerarchia sopra, o con nessuno.

Il Direttivo assegna e revoca il ruolo di Capo Admin (periodicità da definire). L'admin "semplice" deve ottenere accesso alla dashboard, con permessi determinati dal proprio scope. Il modello attuale IdP è globale: vanno progettati lo scope corso/team e la sua verifica nel backend prima di attivare la vista Capo Admin (§19). Un ruolo personalizzato da solo non limita i record visibili.

Una persona admin appartiene a **un solo corso di studi** come dato anagrafico personale, ma può essere admin/Capo Admin con **scope su gruppi di corsi diversi** contemporaneamente: il corso di appartenenza personale e lo scope di responsabilità sono due campi distinti.

---

## 2. Fondamenta

### 2.1 Autorizzazione per capacità (RBAC granulare)

**Implementato:** ruoli e permessi globali in eRBACo (`auth`), con ereditarietà dei ruoli e implicazioni dei permessi. La dashboard legge `me.access` tramite BFF, filtra navigazione/azioni e applica middleware; il backend verifica token, scope del client e permesso della persona per procedura. Le assegnazioni e l'amministrazione RBAC vivono nell'IdP, con delega limitata ai permessi posseduti.

**Da realizzare:** autorizzazione sui nuovi registri soci/censimento, scoping corso/team e permessi dei flussi futuri. Il catalogo implementato usa chiavi come `tg:users:read` e `web:content:write`, non la proposta `capability_grant` con chiave e livello separati. Le azioni ad alto impatto devono mostrare il permesso richiesto e richiedere conferma esplicita. Catalogo attuale e requisiti futuri sono distinti in [`RBAC_Ruoli_Permessi.md`](./RBAC_Ruoli_Permessi.md).

### 2.2 Audit amministrativo unificato

**Stato parziale:** l’IdP ha un audit RBAC append-only con prima/dopo; il backend registra attori IdP nelle azioni di moderazione, nei grant e nelle scritture dei contenuti. Questo non copre ancora un unico storico amministrativo per tutti i moduli.

**Requisito residuo:** ogni mutazione amministrativa deve produrre una voce di audit con: attore, ruolo al momento dell'azione, timestamp, oggetto modificato, valori prima/dopo, motivo (obbligatorio per azioni sensibili), esito. Precondizione per esporre dati personali dell'Anagrafica/Censimento a più ruoli.

### 2.3 Ricerca globale

**Da realizzare:** command palette che cerca trasversalmente soci, utenti Telegram, gruppi, membri Azure, FAQ e contenuti. Le ricerche presenti sono di sezione (inclusa ricerca utenti Telegram per ID), non una ricerca globale.

### 2.4 Home come centro operativo

**Implementato:** nuova shell e overview con conteggi di gruppi/utenti Telegram, segnalazioni aperte e grant attivi secondo i permessi; grafico basato sulle date di creazione dei record utenti Telegram (non membri attivi o audience dei gruppi).

**Da realizzare:** indicatori su soci in scadenza, account non riconciliati, grant in scadenza, contenuti da pubblicare e attività recenti, con apertura della lista filtrata corrispondente.

### 2.5 Gestione dei consensi e firma della privacy policy in dashboard

**Da realizzare:** raccolta associativa dei consensi e firma del testo versionato; il consenso OAuth delle applicazioni IdP è un flusso distinto.

Oggi le autorizzazioni privacy vengono raccolte tramite vari form esterni inviati caso per caso: le domande possono cambiare o diventare obsolete nel tempo, e la perdita di un form comporta la perdita della possibilità di dimostrare/recuperare il consenso raccolto con quella versione.

- La firma della privacy policy (e di altre informative) avviene **dentro il flusso della dashboard** (iscrizione socio, §3.1; onboarding/censimento admin, §8), non più solo tramite form esterni scollegati.
- Ogni consenso è legato a una **versione specifica del testo firmato**, con data e revoca tracciabili: un cambiamento futuro del testo non invalida né sovrascrive lo storico dei consensi già raccolti.
- La firma passa per l'audit unificato (§2.2).
- Richiede l'Identity Provider (§2.6) per autenticare con certezza chi sta firmando.

### 2.6 Identity Provider PoliNetwork

**Implementato in una repository autonoma `auth`**, con Better Auth e `@better-auth/oauth-provider` 1.7.2, Postgres/Drizzle; non è un'estensione del server Better Auth legacy del backend.

- Login/registrazione via Google o PoliNetwork Entra, passkey aggiungibili dopo il login; non è previsto il vecchio login email OTP. Entra ammette membri del tenant, respingendo guest e token senza `acct: 0`.
- Telegram si collega nell'account IdP tramite OIDC ufficiale, non tramite il codice legacy del bot; il collegamento non assegna ruoli.
- Verifica studente via codice email solo per `@mail.polimi.it`; `@polimi.it` non è oggi ammesso. Socio e Direttivo sono evidenze da gruppi Entra PoliNetwork, indipendenti da Telegram e Student.
- OIDC già integrato in `polinet.cc` e nella dashboard admin. `web` usa OAuth client credentials per leggere dal backend: il login personale sul sito resta un'integrazione futura.
- Directory utenti, ruoli/permessi, applicazioni (client di servizio e interattivi), chiavi e risorse sono amministrati nell'IdP. L'account personale gestisce identità collegate, passkey e sessioni.

**Da realizzare:** collegamento al registro associativo indipendente da Entra, flussi di censimento/onboarding e firma documenti, e futuro accesso esterno multi-tenant. La base di autenticazione esiste; non implica che questi flussi siano già disponibili. Design e contratti correnti in [`IdentityProvider_Design.md`](./IdentityProvider_Design.md) e [`IdentityProvider_DataModel.md`](./IdentityProvider_DataModel.md).

---

## 3. Anagrafica Soci e Censimento Admin/Team

**Da realizzare:** i due registri descritti qui non sono le directory utenti IdP o Microsoft 365.

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

**Requisito futuro, chiavi da definire nel catalogo IdP:** creazione/modifica per Direttivo/Owner/President inizialmente; lettura assegnabile anche a HR in sola lettura. Un operatore può creare un socio o un record del Censimento Admin/Team senza dover prima creare un account Azure.

---

## 4. Governance e Direttivo

Non verrà realizzata come area dedicata separata. La composizione del Direttivo, il ruolo organizzativo e l'incarico sono coperti dal Censimento Admin/Team (§3.2) e dalla gerarchia ruoli (§1.3).

---

## 5. Dashboard Admin e Capo Admin

**Da realizzare:** vista organizzativa con scope sui record.

- Vista Capo Admin: elenco degli admin del proprio corso di studi con nome, cognome, anno di corso, data di ingresso, flag rappresentante, altre associazioni di appartenenza, telefono, username/contatto Telegram, link rapido WhatsApp/Telegram.
- Filtri: nome/cognome, anno, rappresentanza, altre associazioni.
- Sezione link ai gruppi Telegram di competenza del Capo Admin.
- Permessi: il Capo Admin vede **solo** i dati e i gruppi del proprio ambito (scoping, §2.1).

Il modello dati separa il corso personale (Censimento Admin/Team, §3.2) dallo/dagli scope assegnati come Capo Admin (§1.3).

---

## 6. Gestione Soci e Rinnovi

**Da realizzare:** flusso associativo di ricevute e rinnovi.

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

**Da realizzare:** struttura dei team e separazione degli accessi.

Ogni team (IT, Design & Social, International, HR, Events & Partnerships, ...) è un'entità del Censimento Admin/Team (§3.2, blocco "Relazioni"), con pagina/area indipendente e permesso dedicato (§2.1). Obiettivo iniziale: struttura, ruoli e separazione degli accessi, non le funzionalità specifiche di ciascun team.

---

## 8. Onboarding e Censimento Admin — flusso self-service in dashboard

**Da realizzare:** il login IdP esiste, il flusso organizzativo seguente resta un requisito.

Sia il censimento di nuovi candidati admin, sia il censimento periodico di admin già attivi, avvengono tramite un **flusso automatizzato della dashboard**, attivabile tramite un link o una mail inviata alla persona — non più tramite Telegram e scambio di messaggi manuale.

- Autenticazione preventiva obbligatoria sull'Identity Provider PoliNetwork (§2.6) prima di poter proseguire nel flusso — identifica la persona e determina il tipo di candidatura/censimento applicabile.
- Una volta autenticato, l'utente accede a un'area personale dove può: firmare i documenti richiesti (§2.5), consultare le proprie statistiche, vedere il proprio Capo Admin di riferimento.
- Permessi differenziati per ruolo: ogni membro di PoliNetwork ha un livello di accesso diverso in base a cosa fa/è, ma tutti hanno accesso a qualcosa nella propria area.
- Richieste che risalgono la gerarchia: un admin può presentare dalla propria area la richiesta di diventare admin di un determinato gruppo, e la richiesta arriva al proprio Capo Admin di riferimento per l'approvazione.

Ambito: link/mail di attivazione → autenticazione (Identity Provider) → candidatura o conferma censimento periodico → firma documenti → colloquio/approvazione (per i nuovi) → creazione/aggiornamento profilo (Censimento Admin/Team) → assegnazione corso/ruoli/team → passaggi di ingresso operativo. Il dettaglio del processo (candidatura, colloquio, criteri) resta da definire con HR e Team IT.

---

## 9. Email di compleanno

**Da realizzare.**

Riguarda solo i soci. Dipende dall'Anagrafica Soci (data di nascita) e da un motore email.

---

## 10. FAQ pubbliche

**Implementato:** categorie e CRUD FAQ bilingue IT/EN, ricerca di sezione e modifica inline, con `web:content:write` sulle mutazioni.

**Da realizzare:** riordino drag&drop e workflow bozza/pubblicata; lo schema backend attuale non ha un campo stato di pubblicazione o ordinamento delle FAQ.

---

## 11. Miglioramenti alle aree esistenti

- **Telegram grants**: storico dei grant terminati/interrotti; reminder sulle scadenze imminenti.
- **Telegram groups**: creazione/import di gruppi dalla dashboard, indicatori di salute (gruppo senza owner, invito rotto), statistiche.
- **Microsoft 365/Azure — implementato:** directory in sola lettura (`azure:members:read`), creazione tramite workflow dedicato (`azure:members:create`), lettura gruppi (`azure:groups:read`) e aggiunta/rimozione di utenti esistenti dai gruppi (`azure:groups:write`; il picker richiede anche lettura directory). Nessuna modifica generica di utenti/gruppi. **Residuo:** gestione licenze dalla UI e access review periodico sui gruppi.
- **Guide**: workflow bozza/pubblicazione, anteprima PDF, storico versioni invece di sola sostituzione.

---

## 12. Area Associazioni Partner

**Da realizzare:** accesso esterno e workflow di approvazione. Il CRUD interno delle pagine associazioni è già disponibile e non equivale a questa area.

- Accesso e gestione account per decine di associazioni: si può creare l'account a **uno o più referenti** della stessa associazione fin dal MVP, e i referenti possono **nominare un successore trasferendo l'ownership** del proprio account.
- Richieste di pubblicazione nei gruppi Telegram: le associazioni presentano la richiesta dalla propria pagina/area e PoliNetwork approva. Le richieste possono riguardare più gruppi contemporaneamente; il flusso dovrà mostrare l'elenco completo dei gruppi tra cui scegliere. Resta da chiarire se serva anche l'integrazione WhatsApp.
- Gestione della pagina pubblica dell'associazione con flusso di richiesta/approvazione, al posto dell'attuale CRUD diretto di PoliNetwork.
- Eventuale sistema a crediti: logica ancora non definita.
- Eventi delle associazioni / "PoliTamTam" (§13).

Richiede l'Identity Provider PoliNetwork (§2.6) per l'accesso esterno multi-tenant.

---

## 13. Eventi delle associazioni — PoliTamTam

**Da realizzare.**

Le associazioni partner inseriscono gli eventi dalla propria pagina/area; PoliNetwork può inoltre aggiungere propri eventi, o eventualmente eventi per conto di altre associazioni. Ogni evento richiede approvazione prima di comparire pubblicamente — nessuna pubblicazione diretta.

---

## 14. Area Aziende

Da progettare in dettaglio prima dello sviluppo.

---

## 15. Area proprietari di casa / Bacheca casa e coinquilini

**Da realizzare.**

Riguarda esclusivamente soggetti esterni (proprietari, cercatori di stanza).

---

## 16. Newsletter

**Da realizzare.**

Dipende dall'Anagrafica Soci (segmentazione destinatari) ed eventualmente dagli eventi (§13) come fonte di contenuti.

---

## 17. Vincoli

- Nessuna azione distruttiva su più righe senza anteprima e conferma esplicita.
- Minimizzazione dei dati: ogni campo su soci/admin ha uno scopo dichiarato, un responsabile e un'ipotesi di retention; dati sensibili (es. codice fiscale) solo se realmente necessari.
- Audit prima di esporre dati personali a più ruoli.
- **Requisito residuo:** interfaccia amministrativa bilingue IT/EN con preferenza impostabile per singolo utente. I contenuti FAQ/guide bilingui non equivalgono a una UI amministrativa localizzata, oggi prevalentemente in inglese.

---

## 18. Fuori scope

- Non ridefinisce lo statuto, gli organi sociali o le regole di voto dell'associazione.
- Non decide se e come integrare un gateway di pagamento (Stripe, altro): il pagamento resta un bonifico bancario eseguito fuori dashboard. È invece in scope la verifica del pagamento in dashboard (upload ricevuta, approvazione, ricevuta automatizzata, §6).
- Non propone una contabilità completa (fatture, bilanci).

---

## 19. Decisioni aperte

**§1 — Ruoli e gerarchie**
1. Come estendere il RBAC globale IdP con scope corso/team e controlli sui record nel backend per Capo Admin e Team Lead? La precedente proposta `capability_grant.scopeType` non è implementata.
2. Con quale periodicità viene rinnovato il ruolo di Capo Admin (es. legato all'anno accademico)?

**§2 — Fondamenta**
3. **Decisione architetturale attuata:** IdP autonomo, dashboard OIDC/BFF. Restano da verificare operativamente riconciliazione e cutover coordinato (`LEGACY_ANONYMOUS=deny`, bot enforce), poi rimozione di API/tabelle legacy secondo RFC fasi 5–6.
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
15. Chi approva la riconciliazione dei titolari legacy e assegna i ruoli personalizzati IdP prima del cutover? Le assegnazioni usano `user_role`, non `capability_grant`.
16. **Risolta nel codice:** provider OAuth/OIDC 1.7.2, registrazione applicazioni e client di servizio implementati. Restano provisioning e collaudo dei consumer nell’ambiente di destinazione.
17. **Ordine reale aggiornato:** polinet.cc e admin hanno già il login OIDC; web usa un token di servizio. Quali funzionalità del sito richiederanno il login personale, e quando?
18. Se estendere la verifica studente oltre il solo dominio attualmente ammesso `@mail.polimi.it` (in particolare `@polimi.it`): modifica da progettare, non una configurazione già disponibile.
19. Come riconciliare lo stato `socio` attuale da Entra con il futuro registro associativo paganti/storico e il claim del tesseramento, senza confondere account Microsoft 365 e iscrizione annuale?

---

## 20. Fonti della revisione (12 ottobre 2026)

Riferimenti al codice verificato, fissati allo SHA dopo il fetch:

- **admin** (origin/main): [27a09690](https://github.com/PoliNetworkOrg/admin/tree/27a0969052cf8e846f46642e2c74f6f24f1d3eb1). Login OIDC/BFF e controlli (`src/server/permissions.ts`); shell e overview (`src/features/dashboard/`); FAQ e Microsoft 365 (`src/features/faqs/`, `src/features/azure/`).
- **auth** (origin/main): [7ae7521f](https://github.com/PoliNetworkOrg/auth/tree/7ae7521f895c342fe33ee77264f4f9ef1531055c). Identità e RBAC (`src/db/evidence.ts`, `src/db/rbac.ts`); contratti e migrazione (`docs/idp-telegram-integration-rfc-v3.md`). Le frasi introduttive di README/RFC che descrivono caller non ancora migrati sono precedenti ai commit dei consumer: lo stato qui riportato segue il codice di ciascuno.
- **backend** (origin/main): [84da4cf7](https://github.com/PoliNetworkOrg/backend/tree/84da4cf716210aae371e2aae2de829c651222c6b). Policy (`src/idp/policies.ts`), attori/audit/grant v2, directory e membership Azure, `tg.users.getCreationHistory`; compatibilità legacy documentata nel README.
- **telegram** (origin/main): [cca89904](https://github.com/PoliNetworkOrg/telegram/tree/cca89904267103576285db31e1b646dddd7798ae). Migrazione fase 4b, token/attori, shadow/enforce e audit outbox; README e `docs/idp-phase4b-handoff.md` distinguono implementazione e attività operative.
- **web** (origin/main): [d6b801e7](https://github.com/PoliNetworkOrg/web/tree/d6b801e7a8c8b0728fe073e52a5b45af9c439b29). Fase 4a: token di servizio in `src/lib/backend.ts`; guide, contatti e segnalazioni link. Non risulta introdotto un login personale sul sito.
- **polinet.cc** (origin/main): [d8803264](https://github.com/PoliNetworkOrg/polinet.cc/tree/d88032645cb098128f4187d23840bbb85a9fcdca). Login OIDC già integrato; ultima correzione al callback configurato. Le feature su branch non integrati (alias, analytics) non sono considerate completate.
- **aule** (origin/main): [da941567](https://github.com/PoliNetworkOrg/aule/tree/da941567474cabf6f14ae469a47e044a0cfdd600). PoliAule v2, campus multipli, stanze non prenotabili e orari sconosciuti; progetto separato, senza nuovi requisiti implementati per la dashboard admin.
- **polinetwork.github.io** (origin/master): [a7195b8c](https://github.com/PoliNetworkOrg/polinetwork.github.io/tree/a7195b8cef1bae55f7f281fbf2a3341bd22244e5). Documenti associativi aggiornati e rimando al nuovo sito gruppi; nessun registro soci o flusso rinnovi applicativo.
- **skills** (origin/main): [ed5a52e0](https://github.com/PoliNetworkOrg/skills/tree/ed5a52e021320f69b07745741e38a97fadb57e1e). Cataloghi/template e miglioramenti alle slide; tooling, non funzionalità della dashboard.
- **slides-polinetwork** (origin/main): [bd3953ca](https://github.com/viganogabriele/slides-polinetwork/tree/bd3953ca19cbdf086553d37afaeb6feefc14c187). Aggiornamenti alle presentazioni; materiale di comunicazione, non prova di feature applicative.
- **manifesti:** fetch non riuscito (`Repository not found`); disponibile solo la baseline locale `ba45063` del 30 agosto 2026, documenti di architettura e integrità della pubblicazione. Nessuna conclusione sulle modifiche remote successive.

I checkout e le modifiche locali preesistenti non sono stati aggiornati o inclusi in questa revisione. La PR #68 resta dedicata alla documentazione; non porta nel proprio branch il codice applicativo recente di main.
