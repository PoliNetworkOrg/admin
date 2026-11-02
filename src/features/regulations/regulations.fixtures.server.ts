import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { Files, UserMatch } from "./regulations.contract"

/**
 * Agent mode's sample Regolamenti: an invented Raccolta in the grammar of PoliNetworkOrg/legal (`docs/grammar.md`),
 * the accounts the fake IdP knows, and a stand-in for the `polinetwork-regolamento` class so the dev compiler draws a
 * PDF without the legal repository. With `REGULATIONS_DEV_LEGAL_DIR` pointing at a local checkout of legal, the fake
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
  const classPath = join(root, "shared/polinetwork-regolamento.cls")
  if (!existsSync(join(dir, "RRI.tex")) || !existsSync(classPath)) return null
  const files: Files = { "RRI.tex": readFileSync(join(dir, "RRI.tex"), "utf8") }
  for (const name of readdirSync(join(dir, "regolamenti"))
    .filter((file) => file.endsWith(".tex"))
    .sort())
    files[`regolamenti/${name}`] = readFileSync(join(dir, "regolamenti", name), "utf8")
  return { files, classSource: readFileSync(classPath, "utf8"), fontsDir: join(dir, "fonts") }
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
