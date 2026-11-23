import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Files, UserMatch } from "./regulations.contract"

/**
 * Agent mode's sample Regolamenti: an invented Raccolta in the grammar of PoliNetworkOrg/legal (`docs/grammar.md`),
 * the accounts the fake IdP knows, and a stand-in for the `polinetwork-regolamento` class so the dev compiler draws a
 * PDF without the legal repository. With `REGULATIONS_DEV_LEGAL_DIR` pointing at a local checkout of the documents repository (or legal), the fake
 * serves the real RRI sources and compiles them with the real class and fonts instead (they stay on this machine).
 */

export const FAKE_USERS: UserMatch[] = [
  { id: "u-presidente", name: "Giulia Ferri", email: "giulia.ferri@polinetwork.org" },
  { id: "u-segretario", name: "Marco Bassi", email: "marco.bassi@polinetwork.org" },
  { id: "u-direttivo", name: "Elena Conti", email: "elena.conti@polinetwork.org" },
  { id: "u-socio-1", name: "Luca Moretti", email: "luca.moretti@mail.polimi.it" },
  { id: "u-socio-2", name: "Sara Galli", email: "sara.galli@mail.polimi.it" },
  { id: "u-socio-3", name: "Davide Rinaldi", email: null },
  { id: "u-probiviro", name: "Chiara Testa", email: "chiara.testa@polinetwork.org" },
]

const ENTRY = String.raw`\documentclass{polinetwork-regolamento}

\intestazione{PoliNetwork - Raccolta dei Regolamenti interni}
\approvazione{direttivo}{2026-03-12}

\begin{document}

\begin{center}
  {\Large Raccolta dei Regolamenti Interni}\\
  \delibera
\end{center}

\tableofcontents

\input{regolamenti/fondamentale}
\input{regolamenti/condotta}

\end{document}
`

const FONDAMENTALE = String.raw`\regolamento[id=f0nd4m]{Regolamento Fondamentale}

\articolo[id=a1scop]{Scopo}
Il presente regolamento disciplina gli aspetti fondamentali del funzionamento dell'Associazione, secondo quanto previsto dallo Statuto.

\articolo[id=a2noti]{Notifiche e comunicazioni}
\begin{commi}
  \comma[id=k2n001] Le notifiche ai Soci sono inviate tramite il canale di contatto indicato dallo Statuto.
  \comma[id=k2n002] Salvo diversa indicazione, le notifiche avvengono entro \textbf{trenta giorni}.
\end{commi}

\begin{capo}[id=c4p002]{Emanazione dei regolamenti}

\articolo[id=a3eman]{Raccolta dei Regolamenti Interni}
\begin{commi}
  \comma[id=k3e001] Il Segretario cura la Raccolta dei Regolamenti Interni con tutti i regolamenti in vigore.
  \comma[id=k3e002] L'emanazione di una nuova versione della Raccolta è notificata entro tre giorni dall'approvazione, ai sensi dell'articolo \rif{a2noti} comma \rif{k2n001}.
  \comma[id=k3e003] Contro una versione della Raccolta è ammesso ricorso motivato al Collegio dei Probiviri entro dieci giorni dalla sua emanazione.
  \comma[id=k3e004] Il Consiglio Direttivo modifica i regolamenti secondo la seguente procedura:
  \begin{lettere}
    \lettera il Consiglio Direttivo approva la nuova Raccolta;
    \lettera il Segretario la notifica entro tre giorni;
    \lettera i Soci, entro dieci giorni, possono proporre modifiche.
  \end{lettere}
\end{commi}

\articolo[id=a4rett]{Correzioni}
Il Segretario può correggere errori ortografici o di battitura purché la correzione non alteri il significato del testo.

\end{capo}
`

const CONDOTTA = String.raw`\regolamento[id=c0nd0t]{Regolamento di Condotta Generale}

\articolo[id=b1ambi]{Ambito}
Il presente regolamento si applica a tutti i Soci e ai volontari che operano per l'Associazione.

\articolo[id=b2comp]{Comportamento nei gruppi}
\begin{commi}
  \comma[id=m2c001] Ogni membro tiene un comportamento rispettoso verso gli altri, anche nei gruppi online.
  \comma[id=m2c002] Sono vietati, tra gli altri:
  \begin{elenco}
    \voce messaggi offensivi o discriminatori;
    \voce \emph{spam} e promozioni non autorizzate.
  \end{elenco}
  \comma[id=m2c003] Gli Admin moderano i gruppi secondo le linee guida pubblicate su \url{https://polinetwork.org}.
\end{commi}

\articolo[id=b3sanz]{Sanzioni}
\begin{commi}
  \comma[id=m3s001] Le violazioni del presente regolamento sono segnalate al Consiglio Direttivo.
  \comma[id=m3s002] Nei casi gravi il Consiglio Direttivo può proporre l'esclusione del Socio ai sensi dello Statuto.
\end{commi}
`

const SAMPLE_FILES: Files = {
  "RRI.tex": ENTRY,
  "regolamenti/fondamentale.tex": FONDAMENTALE,
  "regolamenti/condotta.tex": CONDOTTA,
}

/** A minimal stand-in for the shared class: the same macros and numbering, plain article layout, default fonts. */
const STAND_IN_CLASS = String.raw`\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{polinetwork-regolamento}[2026/11/02 agent-mode stand-in]
\DeclareOption*{}
\ProcessOptions\relax
\LoadClass[a4paper,11pt]{article}
\RequirePackage{fontspec}
\RequirePackage[italian]{babel}
\RequirePackage{enumitem}
\RequirePackage{keyval}
\RequirePackage[hidelinks]{hyperref}
\RequirePackage[margin=2.2cm]{geometry}
\setcounter{secnumdepth}{5}
\setcounter{tocdepth}{2}
\setlength{\parindent}{0pt}
\setlength{\parskip}{4pt}
\makeatletter
\define@key{pn}{id}{\def\pn@id{#1}}
\define@key{pn}{nuovapagina}[]{\clearpage}
\newcommand\pn@setid[1]{\def\pn@id{}\setkeys{pn}{#1}}
\newcommand\pn@label{\ifx\pn@id\@empty\else\label{\pn@id}\fi}
\newcount\pn@depth
\newcommand\pn@heading[1]{\ifcase\pn@depth\section{#1}\or\subsection{#1}\or\subsubsection{#1}\or\paragraph{#1}\else\subparagraph{#1}\fi}
\newcommand\regolamento[2][]{\pn@setid{#1}\pn@depth=0 \pn@heading{#2}\pn@label\pn@depth=1 }
\newenvironment{capo}[2][]{\pn@setid{#1}\pn@heading{#2}\pn@label\advance\pn@depth by 1 }{\advance\pn@depth by -1 }
\newcommand\articolo[2][]{\pn@setid{#1}\pn@heading{#2}\pn@label}
\newenvironment{commi}{\begin{enumerate}[label=\arabic*.]}{\end{enumerate}}
\newenvironment{lettere}{\ifnum\@enumdepth>1 \begin{enumerate}[label=\roman*.]\else\begin{enumerate}[label=(\alph*)]\fi}{\end{enumerate}}
\newenvironment{elenco}{\begin{itemize}}{\end{itemize}}
\newcommand\comma[1][]{\pn@setid{#1}\item\pn@label}
\newcommand\lettera[1][]{\item}
\newcommand\voce{\item}
\newcommand\rif[1]{\ref{#1}}
\newcommand\intestazione[1]{}
\def\pn@date#1-#2-#3\relax{#3/#2/#1}
\def\pn@assemblea{assemblea}
\newcommand\pn@approval{}
\newcommand\pn@rectified{}
\newcommand\approvazione[2]{\def\pn@body{#1}\ifx\pn@body\pn@assemblea\def\pn@approval{Approvato dall'Assemblea dei Soci il \pn@date#2\relax}\else\def\pn@approval{Approvato dal Consiglio Direttivo il \pn@date#2\relax}\fi}
\newcommand\rettifica[2][]{\def\pn@who{#1}\ifx\pn@who\@empty\def\pn@rectified{Rettificato dal Segretario il \pn@date#2\relax}\else\def\pn@rectified{Rettificato da #1 su delega del Segretario il \pn@date#2\relax}\fi}
\newcommand\delibera{\pn@approval\ifx\pn@rectified\@empty\else\\\pn@rectified\fi}
\makeatother
`

type LegalCheckout = { files: Files; classSource: string; fontsDir: string }

/** The RRI from a local checkout of PoliNetworkOrg/legal (`REGULATIONS_DEV_LEGAL_DIR`), if one is configured. */
function legalCheckout(): LegalCheckout | null {
  const root = process.env.REGULATIONS_DEV_LEGAL_DIR
  if (!root) return null
  const dir = join(root, "rri/latex")
  // The documents repository keeps the class in `shared/regolamento/`; the old legal layout in `shared/`.
  const classPath = [
    join(root, "shared/regolamento/polinetwork-regolamento.cls"),
    join(root, "shared/polinetwork-regolamento.cls"),
  ].find((path) => existsSync(path))
  if (!existsSync(join(dir, "RRI.tex")) || !classPath) return null
  const fontsDir = [join(root, "shared/regolamento/fonts"), join(dir, "fonts")].find((path) => existsSync(path))
  const files: Files = { "RRI.tex": readFileSync(join(dir, "RRI.tex"), "utf8") }
  for (const name of readdirSync(join(dir, "regolamenti"))
    .filter((file) => file.endsWith(".tex"))
    .sort())
    files[`regolamenti/${name}`] = readFileSync(join(dir, "regolamenti", name), "utf8")
  return { files, classSource: readFileSync(classPath, "utf8"), fontsDir: fontsDir ?? join(dir, "fonts") }
}

const checkout = legalCheckout()

/** The sources of the latest published version. */
export const PUBLISHED_FILES: Files = checkout?.files ?? SAMPLE_FILES

export const ENTRY_FILE = "RRI.tex"

/** The class the dev compiler copies next to the sources. */
export const FAKE_CLASS = checkout?.classSource ?? STAND_IN_CLASS

/** The real fonts, linked into the workdir as `fonts/` when compiling the real class. */
export const FAKE_FONTS_DIR = checkout?.fontsDir ?? null

/** Whether the fake serves the invented sample (its scripted drafts and comments only make sense on it). */
export const USING_SAMPLE = checkout === null

// The other documents of the sample: every kind the dashboard lists besides the RRI.

/** A minimal stand-in for the `polinetwork` class of the generale template: its title macros, plain article layout. */
export const FAKE_GENERALE_CLASS = String.raw`\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{polinetwork}[2026/11/23 agent-mode stand-in]
\DeclareOption*{}
\ProcessOptions\relax
\LoadClass[a4paper,11pt]{article}
\RequirePackage{fontspec}
\RequirePackage[italian]{babel}
\RequirePackage[hidelinks]{hyperref}
\RequirePackage[margin=2.4cm]{geometry}
\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt}
\makeatletter
\def\pn@title{}\def\pn@subtitle{}\def\pn@date{\today}\def\pn@version{}\def\pn@subject{}\def\pn@recipient{}
\newcommand\pnTitle[1]{\def\pn@title{#1}}
\newcommand\pnSubtitle[1]{\def\pn@subtitle{#1}}
\newcommand\pnDate[1]{\def\pn@date{#1}}
\newcommand\pnVersion[1]{\def\pn@version{#1}}
\newcommand\pnSubject[1]{\def\pn@subject{#1}}
\newcommand\pnRecipient[1]{\def\pn@recipient{#1}}
\newcommand\pnMakeHeader{{\small PoliNetwork APS}\par\vspace{4pt}{\LARGE\bfseries\pn@title\par}\ifx\pn@subtitle\@empty\else\vspace{2pt}{\large\pn@subtitle\par}\fi\vspace{6pt}\hrule\vspace{12pt}}
\newcommand\pnMakeMetadata{\begin{tabular}{@{}ll@{}}Data & \pn@date\\\ifx\pn@version\@empty\else Versione & \pn@version\\\fi\end{tabular}\par\vspace{8pt}}
\makeatother
`

/** `documents.json`'s skeletons as the backend fills them (`{{TITLE}}`, `{{KEY}}`, `{{DATE}}`): entry `main.tex`. */
export function skeletonFiles(template: string, title: string, key: string, date: string) {
  const escaped = title.replace(/[\\{}$&%#_~^]/g, (char) => (char === "\\" ? "\\textbackslash{}" : `\\${char}`))
  const id = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0")
  const main =
    template === "regolamento"
      ? String.raw`% ${escaped} (${key}): a new document from the "regolamento" template.
\documentclass{polinetwork-regolamento}

\intestazione{PoliNetwork - ${escaped}}

\begin{document}

\regolamento[id=${id()}]{${escaped}}

\articolo[id=${id()}]{Oggetto}
\begin{commi}
  \comma[id=${id()}] Testo del primo comma.
\end{commi}

\end{document}
`
      : String.raw`% ${escaped} (${key}): a new document from the "generale" template, created on ${date}.
\documentclass[letter]{polinetwork}

\pnTitle{${escaped}}

\begin{document}

\pnMakeHeader

\section{Prima sezione}

Scrivi qui il testo del documento.

\begin{itemize}
  \item Primo punto
  \item Secondo punto
\end{itemize}

\end{document}
`
  const files: Files = { "main.tex": main }
  return { entry: "main.tex", files }
}

export const GENERALE_SAMPLE = {
  /** The Guida della Matricola of one academic year, entry `guida-della-matricola.tex`. */
  guida: (year: string): Files => ({
    "guida-della-matricola.tex": String.raw`\documentclass{polinetwork}

\pnTitle{Guida della Matricola}
\pnSubtitle{Anno accademico ${year}}

\begin{document}

\pnMakeHeader

\section{Benvenuto al Politecnico}

Questa guida raccoglie quello che serve nelle prime settimane: dove trovare gli orari, come iscriversi agli esami e quali gruppi Telegram seguire per il proprio corso di studi.

\section{I gruppi di PoliNetwork}

Ogni corso ha il suo gruppo, gestito da studenti volontari. Li trovi tutti su \url{https://polinetwork.org}.

\begin{itemize}
  \item Gruppi dei corsi di laurea e dei singoli insegnamenti;
  \item gruppi delle residenze e delle associazioni;
  \item il gruppo generale degli studenti${year === "2025/26" ? "" : ", con gli annunci della settimana"}.
\end{itemize}

\section{Servizi online}

I servizi online del Politecnico richiedono il codice persona. Conservalo: serve anche per accedere al Wi-Fi.

\end{document}
`,
  }),
  /** A private document's published text (generale template, entry `main.tex`). */
  lineeGuida: (): Files => ({
    "main.tex": String.raw`% Linee guida interne del Direttivo (linee-guida-direttivo): a new document from the "generale" template.
\documentclass[letter]{polinetwork}

\pnTitle{Linee guida interne del Direttivo}

\begin{document}

\pnMakeHeader

\section{Riunioni}

Il Direttivo si riunisce almeno una volta al mese. L'ordine del giorno è inviato ai componenti tre giorni prima.

\section{Riservatezza}

I dati personali dei Soci discussi nelle riunioni non escono dal Direttivo e non si inoltrano nei gruppi.

\end{document}
`,
  }),
}

/** Statuto and Regolamento Elettorale: self-contained documents of the repository, read-only in the dashboard. */
export const CONSULTAZIONE_SAMPLES: { key: string; title: string; entry: string; files: Files }[] = [
  {
    key: "statuto",
    title: "Statuto",
    entry: "main.tex",
    files: {
      "main.tex": String.raw`\documentclass[a4paper,11pt]{article}
\usepackage{fontspec}
\usepackage[italian]{babel}
\usepackage[margin=2.5cm]{geometry}
\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt}
\begin{document}
\begin{center}{\LARGE\bfseries Statuto dell'Associazione PoliNetwork APS}\end{center}
\section*{Art. 1 -- Denominazione e sede}
È costituita l'associazione di promozione sociale denominata PoliNetwork APS, con sede a Milano.
\section*{Art. 2 -- Scopo}
L'Associazione non ha scopo di lucro e persegue finalità civiche, solidaristiche e di utilità sociale a favore degli studenti del Politecnico di Milano.
\section*{Art. 3 -- Soci}
Possono essere Soci le persone fisiche che ne condividono gli scopi e versano la quota associativa annuale.
\section*{Art. 4 -- Organi}
Sono organi dell'Associazione l'Assemblea dei Soci, il Consiglio Direttivo, il Presidente e il Collegio dei Probiviri.
\end{document}
`,
    },
  },
  {
    key: "elettorale",
    title: "Regolamento Elettorale Direttivo",
    entry: "RE.tex",
    files: {
      "RE.tex": String.raw`\documentclass[a4paper,11pt]{article}
\usepackage{fontspec}
\usepackage[italian]{babel}
\usepackage[margin=2.5cm]{geometry}
\setlength{\parindent}{0pt}
\setlength{\parskip}{5pt}
\begin{document}
\begin{center}{\LARGE\bfseries Regolamento Elettorale del Consiglio Direttivo}\end{center}
\section*{Art. 1 -- Elettorato}
Hanno diritto di voto i Soci in regola con la quota associativa alla data di convocazione dell'Assemblea.
\section*{Art. 2 -- Candidature}
Le candidature si presentano al Segretario almeno sette giorni prima dell'Assemblea elettiva.
\section*{Art. 3 -- Votazione}
Il voto è personale e segreto. Risultano eletti i candidati che ottengono il maggior numero di preferenze.
\end{document}
`,
    },
  },
]

/** Uploaded PDFs: the sample's scans stand in as LaTeX, compiled on first view, so the viewer gets a real file. */
export const UPLOAD_SAMPLES = {
  bilancio: [
    { label: "v2026.04.30", publishedAt: "2026-04-30T17:00:00.000Z", note: "Bozza presentata al Direttivo" },
    { label: "v2026.05.15", publishedAt: "2026-05-15T18:30:00.000Z", note: "Approvato dall'Assemblea dei Soci" },
  ].map(({ label, publishedAt, note }) => ({
    label,
    publishedAt,
    entry: "bilancio.tex",
    files: {
      "bilancio.tex": String.raw`\documentclass[a4paper,11pt]{article}
\usepackage{fontspec}
\usepackage[italian]{babel}
\usepackage[margin=2.5cm]{geometry}
\setlength{\parindent}{0pt}
\begin{document}
{\LARGE\bfseries Bilancio consuntivo 2025}\par\medskip
PoliNetwork APS -- ${note}\par\bigskip
\begin{tabular}{@{}lr@{}}
\textbf{Entrate} & \\
Quote associative & 1.240,00 \\
Contributi & 600,00 \\[6pt]
\textbf{Uscite} & \\
Servizi cloud e domini & 712,40 \\
Eventi & 455,00 \\[6pt]
\textbf{Avanzo} & 672,60 \\
\end{tabular}
\end{document}
`,
    },
  })),
} satisfies Record<string, { label: string; publishedAt: string; entry: string; files: Files }[]>
