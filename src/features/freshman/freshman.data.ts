// Mock content mirrors the fixed slots on /matricole. No public API is called.
export const initialFreshman = {
  resources: [
    {
      id: "featured-1",
      group: "featured",
      title: "Graduatorie",
      description: "Risultati storici e soglie di accesso per i vari corsi di laurea.",
      icon: "chart",
      href: "https://rankings.polinetwork.org/",
    },
    {
      id: "featured-2",
      group: "featured",
      title: "Progetto TOL",
      description: "Informazioni sul test di ingresso (TOL) e su come prepararsi al meglio.",
      icon: "monitor",
      href: "https://tol.polinetwork.org/",
    },
    {
      id: "guides-1",
      group: "guides",
      title: "Guida della matricola",
      description: "Dalla prima iscrizione alla vita in campus: il manuale completo per ogni nuovo studente.",
      icon: "book",
      href: "/matricole/guida",
    },
    {
      id: "guides-2",
      group: "guides",
      title: "Mappa Microonde",
      description: "Dove scaldare il pranzo nei vari campus.",
      icon: "map",
      href: "",
    },
    {
      id: "guides-3",
      group: "guides",
      title: "Corsi a Scelta",
      description: "Consigli su come comporre il Piano di Studi.",
      icon: "book",
      href: "",
    },
    {
      id: "guides-4",
      group: "guides",
      title: "News",
      description: "Le ultime novità dagli studenti del Politecnico.",
      icon: "news",
      href: "",
    },
    {
      id: "guides-5",
      group: "guides",
      title: "Borsa di Studio",
      description: "Requisiti e scadenze per le agevolazioni.",
      icon: "money",
      href: "",
    },
    {
      id: "materials-1",
      group: "materials",
      title: "Materiali",
      description:
        "Il più grande archivio didattico creato dagli studenti per gli studenti del Politecnico di Milano. Migliaia di appunti e temi d’esame.",
      icon: "folder",
      href: "/materials",
    },
    {
      id: "tools-1",
      group: "tools",
      title: "Sync Orario",
      description: "",
      icon: "repeat",
      href: "https://bebora.github.io/polimi-schedule-js/",
    },
    {
      id: "tools-2",
      group: "tools",
      title: "WeBeep Sync",
      description: "",
      icon: "refresh",
      href: "https://github.com/toto04/webeep-sync",
    },
  ],
  telegram: [
    {
      id: "telegram-1",
      group: "telegram",
      title: "Generale",
      description: "",
      icon: "bell",
      href: "https://t.me/PoliGruppo",
    },
    {
      id: "telegram-2",
      group: "telegram",
      title: "Matricole",
      description: "",
      icon: "user",
      href: "https://t.me/polimatricole",
    },
    {
      id: "telegram-3",
      group: "telegram",
      title: "Ripetizioni",
      description: "",
      icon: "users",
      href: "https://t.me/joinchat/l10OF3vF6fEzOTRk",
    },
    {
      id: "telegram-4",
      group: "telegram",
      title: "PoliBook",
      description: "",
      icon: "book",
      href: "https://t.me/joinchat/6nmuXXhAOr1mYTJk",
    },
    {
      id: "telegram-5",
      group: "telegram",
      title: "DSU",
      description: "",
      icon: "money",
      href: "https://t.me/joinchat/4kO9DtAiTVM0NTU0",
    },
    {
      id: "telegram-6",
      group: "telegram",
      title: "Mercatino",
      description: "",
      icon: "cart",
      href: "https://t.me/mercatinopolimi",
    },
    {
      id: "telegram-7",
      group: "telegram",
      title: "Case",
      description: "",
      icon: "home",
      href: "https://t.me/joinchat/jmpNOitFNFw1MzJk",
    },
    {
      id: "telegram-8",
      group: "telegram",
      title: "Consigli PC",
      description: "",
      icon: "monitor",
      href: "https://t.me/joinchat/oD7NGpl0W6VjYmI0",
    },
  ],
  faqIds: ["faq-1", "faq-2", "faq-3", "faq-4", "faq-5"],
}

export const freshmanFaqCatalog = [
  {
    id: "faq-1",
    question: "Le lezioni della prima settimana si tengono regolarmente?",
    answer:
      "Spesso, la prima settimana, i Professori utilizzano le ore destinate alle esercitazioni per qualche ora di lezione in più: saranno quindi i docenti a specificare come verranno utilizzate queste ore. Dunque, le esercitazioni non sono da considerarsi annullate, salvo diversa comunicazione da parte del docente o dell'esercitatore.",
  },
  {
    id: "faq-2",
    question: "Come faccio ad accedere ai materiali del corso?",
    answer:
      "I materiali dei corsi sono disponibili su Beep (il portale e-learning del Politecnico). Puoi accedervi con le tue credenziali di Ateneo (codice persona e password). Ogni docente carica le proprie slide, esercizi e risorse direttamente sulla pagina del corso.",
  },
  {
    id: "faq-3",
    question: "Come funziona la prenotazione agli esami?",
    answer:
      "La prenotazione agli esami avviene tramite il portale Online Services (servizionline.polimi.it). Devi prenotarti entro la scadenza indicata per ogni appello. Ricordati di verificare i prerequisiti necessari prima di iscriverti a un esame.",
  },
  {
    id: "faq-4",
    question: "Cos'è il codice persona e dove lo trovo?",
    answer:
      "Il codice persona è il tuo identificativo univoco al Politecnico, composto da 6 cifre. Lo trovi nella lettera di ammissione o nella mail di benvenuto ricevuta dopo l'immatricolazione. Serve per accedere a tutti i servizi online dell'Ateneo.",
  },
  {
    id: "faq-5",
    question: "Come posso contattare PoliNetwork?",
    answer:
      "Puoi contattare PoliNetwork tramite i nostri canali Telegram o attraverso il sito ufficiale. Siamo un'associazione studentesca e offriamo supporto, risorse e una community per tutti gli studenti del Politecnico.",
  },
  // Extra demo questions exercise selection outside the five featured positions.
  {
    id: "faq-6",
    question: "Dove posso trovare i gruppi del mio corso?",
    answer:
      "Nella sezione Gruppi del sito puoi cercare i gruppi della community dedicati ai corsi. Questa risposta è un esempio del catalogo demo.",
  },
  {
    id: "faq-7",
    question: "Dove trovo la guida della matricola aggiornata?",
    answer:
      "La pagina Guida della Matricola permette di consultare e scaricare il PDF. Questa risposta è un esempio del catalogo demo.",
  },
  {
    id: "faq-8",
    question: "Come posso contribuire a PoliNetwork?",
    answer:
      "Puoi partire dalla pagina Unisciti a noi e scoprire le attività dell’associazione. Questa risposta è un esempio del catalogo demo.",
  },
]
