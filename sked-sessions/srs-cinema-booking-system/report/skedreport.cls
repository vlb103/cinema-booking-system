%% skedreport.cls
%% Document class for SKED technical documents (Socratic Knowledge
%% Elicitation & Documentation). XeLaTeX only.
%%
%% Options
%%   profile = ieee | dstu | apa   layout, headings, captions, citations
%%   lang    = uk | en | <babel locale name>   main document language
%%   review                        show K* ledger tags (\sked{...}) in the margin
%%   any other option is passed to extarticle (e.g. 12pt)
%%
%% Compile with: xelatex main (twice). Bibliography is pre-rendered into
%% references.tex by bibfmt.py, so no biber/bibtex run is needed.
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{skedreport}[2026/09/23 v0.1.0 SKED technical report class]

\RequirePackage{iftex}
\RequirePackage{etoolbox}
\RequirePackage{kvoptions}
\SetupKeyvalOptions{family=sked,prefix=sked@}
\DeclareStringOption[ieee]{profile}
\DeclareStringOption[uk]{lang}
\DeclareBoolOption[false]{review}
\DeclareDefaultOption{\PassOptionsToClass{\CurrentOption}{extarticle}}
\ProcessKeyvalOptions*

\iftutex\else
  \ClassError{skedreport}{Compile with XeLaTeX (or LuaLaTeX)}{Run: xelatex main.tex}
\fi

% ------------------------------------------------------------ profile flags
\newif\ifsked@ieee \newif\ifsked@dstu \newif\ifsked@apa
\ifdefstring{\sked@profile}{dstu}{\sked@dstutrue}{%
  \ifdefstring{\sked@profile}{apa}{\sked@apatrue}{\sked@ieeetrue}}

\ifsked@dstu
  \PassOptionsToClass{14pt}{extarticle}
\else\ifsked@apa
  \PassOptionsToClass{12pt}{extarticle}
\else
  \PassOptionsToClass{11pt}{extarticle}
\fi\fi
\LoadClass[a4paper,oneside]{extarticle}

% ------------------------------------------------------------ language
\def\sked@babelname{\sked@lang}
\def\sked@key{en}
\ifdefstring{\sked@lang}{uk}{\def\sked@babelname{ukrainian}\def\sked@key{uk}}{}
\ifdefstring{\sked@lang}{ukrainian}{\def\sked@babelname{ukrainian}\def\sked@key{uk}}{}
\ifdefstring{\sked@lang}{en}{\def\sked@babelname{english}}{}
\ifdefstring{\sked@lang}{ru}{\def\sked@babelname{russian}}{}
\ifdefstring{\sked@lang}{pl}{\def\sked@babelname{polish}}{}
\ifdefstring{\sked@lang}{de}{\def\sked@babelname{german}}{}

\RequirePackage[provide=*]{babel}
\ifdefstring{\sked@babelname}{english}{%
  \babelprovide[import,main]{english}
  \babelprovide[import]{ukrainian}
}{%
  \edef\sked@tmp{\noexpand\babelprovide[import,main]{\sked@babelname}}\sked@tmp
  \babelprovide[import]{english}
}

% localized strings: \sked@s{key}
\newcommand\sked@def[3]{\csdef{sked@s@#1@#2}{#3}}
\newcommand\sked@s[1]{\ifcsdef{sked@s@\sked@key @#1}{\csuse{sked@s@\sked@key @#1}}{\csuse{sked@s@en@#1}}}
% Ukrainian
\sked@def{uk}{keywords}{Ключові слова}
\sked@def{uk}{abstract}{Анотація}
\sked@def{uk}{abstract@dstu}{РЕФЕРАТ}
\sked@def{uk}{toc}{Зміст}
\sked@def{uk}{toc@dstu}{ЗМІСТ}
\sked@def{uk}{refs}{Список літератури}
\sked@def{uk}{refs@dstu}{ПЕРЕЛІК ДЖЕРЕЛ ПОСИЛАНЬ}
\sked@def{uk}{refs@apa}{Список використаних джерел}
\sked@def{uk}{fig}{Рис.}
\sked@def{uk}{fig@dstu}{Рисунок}
\sked@def{uk}{fig@apa}{Рисунок}
\sked@def{uk}{tab}{Таблиця}
\sked@def{uk}{alg}{Алгоритм}
\sked@def{uk}{lst}{Лістинг}
\sked@def{uk}{input}{Вхід:}
\sked@def{uk}{output}{Вихід:}
\sked@def{uk}{doctype}{Тип документа}
\sked@def{uk}{version}{Версія}
\sked@def{uk}{date}{Дата}
\sked@def{uk}{author}{Автор}
\sked@def{uk}{affiliation}{Організація}
\sked@def{uk}{platform}{Платформа}
\sked@def{uk}{udc}{УДК}
\sked@def{uk}{pages}{с.}
\sked@def{uk}{figs}{рис.}
\sked@def{uk}{tabs}{табл.}
\sked@def{uk}{src@one}{джерело}
\sked@def{uk}{src@few}{джерела}
\sked@def{uk}{src@many}{джерел}
\sked@def{uk}{figref}{рис.}
\sked@def{uk}{tabref}{табл.}
\sked@def{uk}{algref}{алг.}
\sked@def{uk}{lstref}{лістинг}
\sked@def{uk}{secref}{розд.}
\sked@def{uk}{appendix}{Додаток}
\sked@def{uk}{Figref}{Рис.}
\sked@def{uk}{Tabref}{Табл.}
\sked@def{uk}{Algref}{Алгоритм}
\sked@def{uk}{Lstref}{Лістинг}
\sked@def{uk}{Secref}{Розділ}
% English
\sked@def{en}{keywords}{Keywords}
\sked@def{en}{abstract}{Abstract}
\sked@def{en}{abstract@dstu}{ABSTRACT}
\sked@def{en}{toc}{Contents}
\sked@def{en}{toc@dstu}{CONTENTS}
\sked@def{en}{refs}{References}
\sked@def{en}{refs@dstu}{REFERENCES}
\sked@def{en}{refs@apa}{References}
\sked@def{en}{fig}{Fig.}
\sked@def{en}{fig@dstu}{Figure}
\sked@def{en}{fig@apa}{Figure}
\sked@def{en}{tab}{Table}
\sked@def{en}{alg}{Algorithm}
\sked@def{en}{lst}{Listing}
\sked@def{en}{input}{Input:}
\sked@def{en}{output}{Output:}
\sked@def{en}{doctype}{Document type}
\sked@def{en}{version}{Version}
\sked@def{en}{date}{Date}
\sked@def{en}{author}{Author}
\sked@def{en}{affiliation}{Affiliation}
\sked@def{en}{platform}{Platform}
\sked@def{en}{udc}{UDC}
\sked@def{en}{pages}{p.}
\sked@def{en}{figs}{fig.}
\sked@def{en}{tabs}{tab.}
\sked@def{en}{src@one}{source}
\sked@def{en}{src@few}{sources}
\sked@def{en}{src@many}{sources}
\sked@def{en}{figref}{Fig.}
\sked@def{en}{tabref}{Table}
\sked@def{en}{algref}{Algorithm}
\sked@def{en}{lstref}{Listing}
\sked@def{en}{secref}{Section}
\sked@def{en}{appendix}{Appendix}
\sked@def{en}{Figref}{Fig.}
\sked@def{en}{Tabref}{Table}
\sked@def{en}{Algref}{Algorithm}
\sked@def{en}{Lstref}{Listing}
\sked@def{en}{Secref}{Section}

\newcommand\sked@sp[1]{% profile-specific string with fallback
  \ifsked@dstu\ifcsdef{sked@s@\sked@key @#1@dstu}{\csuse{sked@s@\sked@key @#1@dstu}}{\sked@s{#1}}%
  \else\ifsked@apa\ifcsdef{sked@s@\sked@key @#1@apa}{\csuse{sked@s@\sked@key @#1@apa}}{\sked@s{#1}}%
  \else\sked@s{#1}\fi\fi}

% ------------------------------------------------------------ fonts
\RequirePackage{fontspec}
% fontspec applies Ligatures=TeX to roman and sans only; monospace keeps straight quotes
\ExplSyntaxOn
\cs_new_protected:Npn \sked_first_font:Nn #1#2
  {
    \bool_set_false:N \l_tmpa_bool
    \clist_map_inline:nn {#2}
      {
        \bool_if:NF \l_tmpa_bool
          {
            \fontspec_font_if_exist:nT {##1}
              { #1 {##1} \bool_set_true:N \l_tmpa_bool }
          }
      }
    \bool_if:NF \l_tmpa_bool
      { \msg_warning:nnn { skedreport } { nofont } {#2} }
  }
\msg_new:nnn { skedreport } { nofont }
  { None~of~the~fonts~'#1'~was~found.~Install~one~(Liberation,~DejaVu,~PT~or~CMU~fonts~cover~Cyrillic). }
\NewDocumentCommand \skedfirstfont { m m } { \sked_first_font:Nn #1 {#2} }
\ExplSyntaxOff
\skedfirstfont\setmainfont{Times New Roman,Liberation Serif,PT Serif,CMU Serif,FreeSerif,DejaVu Serif}
\skedfirstfont\setsansfont{Arial,Liberation Sans,PT Sans,CMU Sans Serif,FreeSans,DejaVu Sans}
\skedfirstfont\setmonofont{Liberation Mono,DejaVu Sans Mono,PT Mono,CMU Typewriter Text,FreeMono}

% ------------------------------------------------------------ core packages
\RequirePackage{amsmath,amssymb}
\RequirePackage{xcolor}
\RequirePackage{graphicx}
\RequirePackage{booktabs,tabularx,array,multirow,makecell,longtable}
% L: ragged-right X column (avoids stretched word gaps in narrow text columns)
\newcolumntype{L}{>{\raggedright\arraybackslash}X}
\RequirePackage{enumitem}
\RequirePackage{setspace}
\RequirePackage{float}
\RequirePackage{lastpage}
\RequirePackage{totcount}
\RequirePackage{tikz}
\usetikzlibrary{arrows.meta,positioning,shapes.geometric,shapes.misc,fit,calc,backgrounds}
\RequirePackage{algorithm}
\RequirePackage{algpseudocode}
\RequirePackage{listings}
\RequirePackage{fvextra}
\RequirePackage{newfloat}
\RequirePackage[protrusion=true,expansion=false]{microtype}
\RequirePackage{caption}
\RequirePackage{titlesec}
\RequirePackage{tocloft}
\RequirePackage{fancyhdr}
\RequirePackage{chngcntr}
\RequirePackage{csquotes}
\ifsked@apa\RequirePackage[round,authoryear]{natbib}\fi

% line breaking safety net: prevents overfull lines when hyphenation
% patterns for the document language are missing
\setlength{\emergencystretch}{3em}
\tolerance=800

% ------------------------------------------------------------ colors
\ifsked@ieee
  \definecolor{skedaccent}{HTML}{0B3C6E}
  \definecolor{skedaccent2}{HTML}{3E6A94}
\else
  \definecolor{skedaccent}{HTML}{000000}
  \definecolor{skedaccent2}{HTML}{000000}
\fi
\definecolor{skedrule}{HTML}{8FA9C4}
\definecolor{skedfill}{HTML}{E8F0F8}
\definecolor{skedmuted}{HTML}{6B6B6B}

% ------------------------------------------------------------ page layout
\RequirePackage{geometry}
\ifsked@dstu
  \geometry{left=25mm,right=15mm,top=20mm,bottom=20mm,headheight=16pt,headsep=6mm,includehead=false}
  \onehalfspacing
  \setlength{\parindent}{1.25cm}
  \setlength{\parskip}{0pt}
\else\ifsked@apa
  \geometry{margin=25.4mm,headheight=15pt}
  \doublespacing
  \setlength{\parindent}{12.7mm}
  \setlength{\parskip}{0pt}
\else
  \geometry{left=25mm,right=25mm,top=27mm,bottom=27mm,headheight=14pt}
  \setlength{\parindent}{0pt}
  \setlength{\parskip}{0.55em plus 0.1em}
\fi\fi
\newcommand\skedgeometry[1]{\geometry{#1}}
\RequirePackage{indentfirst}

% ------------------------------------------------------------ metadata
\def\sked@title{}\def\sked@subtitle{}\def\sked@author{}\def\sked@affiliation{}
\def\sked@organization{}\def\sked@doctype{}\def\sked@version{}\def\sked@date{}
\def\sked@city{}\def\sked@udc{}\def\sked@keywords{}\def\sked@platform{}
\def\sked@shorttitle{}
\def\sked@authorlabel{\sked@s{author}}
\newcommand\skedtitle[2][]{\def\sked@title{#2}\ifstrempty{#1}{\def\sked@shorttitle{#2}}{\def\sked@shorttitle{#1}}}
\newcommand\skedsubtitle[1]{\def\sked@subtitle{#1}}
\newcommand\skedauthor[1]{\def\sked@author{#1}}
\newcommand\skedauthorlabel[1]{\def\sked@authorlabel{#1}}
\newcommand\skedaffiliation[1]{\def\sked@affiliation{#1}}
\newcommand\skedorganization[1]{\def\sked@organization{#1}}
\newcommand\skeddoctype[1]{\def\sked@doctype{#1}}
\newcommand\skedversion[1]{\def\sked@version{#1}}
\newcommand\skeddate[1]{\def\sked@date{#1}}
\newcommand\skedcity[1]{\def\sked@city{#1}}
\newcommand\skedudc[1]{\def\sked@udc{#1}}
\newcommand\skedkeywords[1]{\def\sked@keywords{#1}}
\newcommand\skedplatform[1]{\def\sked@platform{#1}}
\AtBeginDocument{%
  \ifdefempty{\sked@date}{\def\sked@date{\today}}{}%
  \hypersetup{pdftitle={\sked@title},pdfauthor={\sked@author},pdfkeywords={\sked@keywords}}}

% ------------------------------------------------------------ counters for statistics
\newtotcounter{skedfig}
\newtotcounter{skedtab}
\newtotcounter{skedsrc}
\AtBeginEnvironment{figure}{\stepcounter{skedfig}}
\AtBeginEnvironment{table}{\stepcounter{skedtab}}
% Ukrainian-style plural: \skedplural{n}{one}{few}{many}
\newcount\sked@n \newcount\sked@m
\newcommand\skedplural[4]{%
  \sked@n=#1\relax
  \sked@m=\sked@n \divide\sked@m by 100 \multiply\sked@m by 100
  \advance\sked@n by -\sked@m
  \ifnum\sked@n>10 \ifnum\sked@n<15 #4\else\sked@pl{#2}{#3}{#4}\fi\else\sked@pl{#2}{#3}{#4}\fi}
\newcommand\sked@pl[3]{%
  \sked@m=\sked@n \divide\sked@m by 10 \multiply\sked@m by 10
  \advance\sked@n by -\sked@m
  \ifnum\sked@n=1 #1\else\ifnum\sked@n>1 \ifnum\sked@n<5 #2\else#3\fi\else#3\fi\fi}
\newcommand\skedstats{%
  \pageref*{LastPage}~\sked@s{pages},
  \total{skedfig}~\sked@s{figs},
  \total{skedtab}~\sked@s{tabs},
  \total{skedsrc}~\skedplural{\totvalue{skedsrc}}{\sked@s{src@one}}{\sked@s{src@few}}{\sked@s{src@many}}}

% ------------------------------------------------------------ headings
\ifsked@dstu
  \setcounter{secnumdepth}{3}
  \titleformat{\section}{\normalfont\bfseries\centering}{\thesection}{0.6em}{\MakeUppercase}
  \titleformat{\subsection}[hang]{\normalfont\bfseries}{\hspace*{\parindent}\thesubsection}{0.6em}{}
  \titleformat{\subsubsection}[hang]{\normalfont\bfseries\itshape}{\hspace*{\parindent}\thesubsubsection}{0.6em}{}
  \titlespacing*{\section}{0pt}{0pt}{1.5em}
  \titlespacing*{\subsection}{0pt}{1em}{0.5em}
  \titlespacing*{\subsubsection}{0pt}{0.8em}{0.4em}
  \newcommand\sked@sectionhook{\clearpage}
  \pretocmd{\section}{\sked@sectionhook}{}{}
  \counterwithin{figure}{section}
  \counterwithin{table}{section}
  \counterwithin{equation}{section}
  \renewcommand\thefigure{\thesection.\arabic{figure}}
  \renewcommand\thetable{\thesection.\arabic{table}}
  \renewcommand\theequation{\thesection.\arabic{equation}}
\else\ifsked@apa
  \setcounter{secnumdepth}{0}
  \titleformat{\section}{\normalfont\bfseries\centering}{}{0pt}{}
  \titleformat{\subsection}{\normalfont\bfseries}{}{0pt}{}
  \titleformat{\subsubsection}{\normalfont\bfseries\itshape}{}{0pt}{}
  \titlespacing*{\section}{0pt}{1em}{0.2em}
  \titlespacing*{\subsection}{0pt}{0.8em}{0.2em}
  \titlespacing*{\subsubsection}{0pt}{0.6em}{0.2em}
\else
  \setcounter{secnumdepth}{3}
  \titleformat{\section}{\normalfont\Large\bfseries\color{skedaccent}}{\thesection.}{0.6em}{}[{\color{skedaccent}\titlerule[0.6pt]}]
  \titleformat{\subsection}{\normalfont\large\bfseries\color{skedaccent2}}{\thesubsection.}{0.5em}{}
  \titleformat{\subsubsection}{\normalfont\normalsize\itshape\color{skedaccent2}}{\thesubsubsection.}{0.5em}{}
  \titlespacing*{\section}{0pt}{1.6em}{0.9em}
  \titlespacing*{\subsection}{0pt}{1.2em}{0.5em}
  \titlespacing*{\subsubsection}{0pt}{1em}{0.4em}
\fi\fi

% unnumbered structural heading that still goes to the table of contents
\newcommand\skedunnumbered[1]{%
  \ifsked@dstu\clearpage\fi
  \section*{#1}%
  \addcontentsline{toc}{section}{#1}}

% ------------------------------------------------------------ table of contents
\renewcommand\cftsecfont{\bfseries}
\renewcommand\cftsecpagefont{\bfseries}
\renewcommand\cftsecleader{\cftdotfill{\cftdotsep}}
\ifsked@dstu
  \renewcommand\cftsecfont{\normalfont}
  \renewcommand\cftsecpagefont{\normalfont}
  \renewcommand\cfttoctitlefont{\hfill\normalfont\bfseries}
  \renewcommand\cftaftertoctitle{\hfill}
\else\ifsked@apa
  \renewcommand\cfttoctitlefont{\hfill\normalfont\bfseries}
  \renewcommand\cftaftertoctitle{\hfill}
  \setcounter{tocdepth}{2}
\else
  \renewcommand\cfttoctitlefont{\normalfont\Large\bfseries\color{skedaccent}}
  \renewcommand\cftaftertoctitle{\par\vspace{-0.6em}{\color{skedaccent}\rule{\textwidth}{0.6pt}}\vspace{-0.4em}}
  \renewcommand\cftsecaftersnum{}
\fi\fi
\newcommand\skedtoc{%
  \clearpage
  \tableofcontents
  \clearpage}

% ------------------------------------------------------------ captions and names
\ifsked@dstu
  \DeclareCaptionLabelSeparator{skeddash}{ – }
  \captionsetup{labelsep=skeddash,font=normalsize,justification=centering,singlelinecheck=false}
  \captionsetup[table]{position=top,justification=raggedright,singlelinecheck=false,skip=4pt}
  \captionsetup[figure]{position=bottom,skip=6pt}
\else\ifsked@apa
  \captionsetup{labelfont=bf,textfont=it,labelsep=newline,justification=raggedright,singlelinecheck=false,position=top,font={normalsize,singlespacing}}
\else
  \captionsetup{labelfont={bf,color=skedaccent},labelsep=period,font=small,justification=centering}
  \captionsetup[table]{position=top,skip=5pt}
  \captionsetup[figure]{position=bottom,skip=6pt}
\fi\fi
\captionsetup[lstlisting]{font=small,labelfont=bf,labelsep=period,singlelinecheck=false,justification=centering}
\ifsked@apa\else\AtEndPreamble{\captionsetup[codelisting]{position=bottom,skip=4pt}}\fi

\newcommand\sked@captions{%
  \renewcommand\figurename{\sked@sp{fig}}%
  \renewcommand\tablename{\sked@s{tab}}%
  \renewcommand\contentsname{\sked@sp{toc}}%
  \renewcommand\refname{\sked@sp{refs}}%
  \renewcommand\abstractname{\sked@sp{abstract}}}
\expandafter\addto\csname captions\sked@babelname\endcsname{\sked@captions}
\AtBeginDocument{\sked@captions
  \renewcommand\lstlistingname{\sked@s{lst}}%
  \floatname{algorithm}{\sked@s{alg}}}

% ------------------------------------------------------------ code blocks
% skedcode (fvextra Verbatim) handles any Unicode text, including Cyrillic
% comments and strings. Wrap it in the codelisting float for a caption.
% lstlisting (listings) is kept for ASCII-only code that needs syntax
% highlighting: listings mis-orders characters above U+00FF under XeTeX.
\DeclareFloatingEnvironment[fileext=lol,placement=htbp]{codelisting}
\DefineVerbatimEnvironment{skedcode}{Verbatim}{%
  numbers=left,numbersep=6pt,fontsize=\small,frame=single,framesep=2mm,
  rulecolor=\color{skedrule},breaklines=true,breakanywhere=false,xleftmargin=1.6em,
  tabsize=4}
\AtBeginDocument{\renewcommand\codelistingname{\sked@s{lst}}}
\ifsked@dstu\AtEndPreamble{\counterwithin{codelisting}{section}}\fi

% ------------------------------------------------------------ algorithms and listings
\algrenewcommand\algorithmicrequire{\textbf{\sked@s{input}}}
\algrenewcommand\algorithmicensure{\textbf{\sked@s{output}}}
\ifsked@dstu\counterwithin{algorithm}{section}\fi
\lstset{
  basicstyle=\ttfamily\small,
  columns=fullflexible,keepspaces=true,
  breaklines=true,breakatwhitespace=false,
  frame=single,rulecolor=\color{skedrule},backgroundcolor=\color{skedfill!40},
  numbers=left,numberstyle=\tiny\color{skedmuted},numbersep=6pt,xleftmargin=1.6em,framexleftmargin=1.4em,
  captionpos=b,extendedchars=true,showstringspaces=false,
  keywordstyle=\bfseries\color{skedaccent},commentstyle=\itshape\color{skedmuted},
  stringstyle=\color{skedaccent2}}

% ------------------------------------------------------------ lists
\ifsked@dstu
  \setlist{nosep,leftmargin=*,labelindent=\parindent}
  \setlist[itemize]{label=–}
\else
  \setlist{itemsep=0.15em,topsep=0.35em}
\fi

% ------------------------------------------------------------ TikZ styles
\tikzset{
  sked box/.style={draw=skedaccent,fill=skedfill,rounded corners=3pt,thick,align=center,
    minimum height=1.1cm,minimum width=2.8cm,font=\small\bfseries,text=skedaccent,inner sep=4pt},
  sked note/.style={draw=skedrule,dashed,rounded corners=3pt,align=center,font=\footnotesize,inner sep=4pt},
  sked arrow/.style={-{Stealth[length=2.2mm]},thick,draw=skedaccent},
  sked back/.style={-{Stealth[length=2.2mm]},thick,dashed,draw=skedaccent2},
  sked label/.style={font=\scriptsize\itshape,text=skedmuted,fill=white,inner sep=1.5pt},
}

% ------------------------------------------------------------ cross-reference helpers
\newcommand\figref[1]{\sked@s{figref}~\ref{#1}}
\newcommand\tabref[1]{\sked@s{tabref}~\ref{#1}}
\newcommand\algoref[1]{\sked@s{algref}~\ref{#1}}% \algref is taken by algorithmicx
\newcommand\lstref[1]{\sked@s{lstref}~\ref{#1}}
\newcommand\secref[1]{\sked@s{secref}~\ref{#1}}
% sentence-initial forms
\newcommand\Figref[1]{\sked@s{Figref}~\ref{#1}}
\newcommand\Tabref[1]{\sked@s{Tabref}~\ref{#1}}
\newcommand\Algoref[1]{\sked@s{Algref}~\ref{#1}}
\newcommand\Lstref[1]{\sked@s{Lstref}~\ref{#1}}
\newcommand\Secref[1]{\sked@s{Secref}~\ref{#1}}
\newcommand\eqnref[1]{(\ref{#1})}
\ifsked@apa\else
  \providecommand\citep{\cite}
  \providecommand\citet{\cite}
\fi

% ------------------------------------------------------------ K* ledger tags
% \sked{K3,K7}: links the surrounding text to ledger entries. Invisible in the
% final document; shown in the margin with the `review` option.
\newif\ifsked@infloat
\AtBeginEnvironment{figure}{\sked@infloattrue}
\AtBeginEnvironment{table}{\sked@infloattrue}
\AtBeginEnvironment{algorithm}{\sked@infloattrue}
\AtBeginEnvironment{minipage}{\sked@infloattrue}
\AtBeginEnvironment{codelisting}{\sked@infloattrue}
\newcommand\sked[1]{\@bsphack
  \ifsked@review
    \ifinner\sked@infloattrue\fi
    \ifsked@infloat
      \textsuperscript{\tiny\sffamily\color{red!70!black}#1}%
    \else
      \marginpar{\raggedright\tiny\sffamily\color{red!70!black}#1}%
    \fi
  \fi\@esphack}
\ifsked@review\setlength{\marginparwidth}{14mm}\setlength{\marginparsep}{2mm}\fi

% ------------------------------------------------------------ headers and footers
\pagestyle{fancy}
\fancyhf{}
\ifsked@dstu
  \renewcommand\headrulewidth{0pt}
  \fancyhead[R]{\thepage}
\else\ifsked@apa
  \renewcommand\headrulewidth{0pt}
  \fancyhead[R]{\thepage}
\else
  \renewcommand\headrulewidth{0.4pt}
  \fancyhead[L]{\small\itshape\sked@shorttitle}
  \fancyhead[R]{\small\thepage}
\fi\fi
\fancypagestyle{plain}{\fancyhf{}\ifsked@ieee\renewcommand\headrulewidth{0pt}\fancyfoot[C]{\small\thepage}\else\fancyhead[R]{\thepage}\fi}

% ------------------------------------------------------------ title page
\newcommand\sked@metarowx[2]{\ifdefempty{#2}{}{\textbf{#1:} & #2\\}}
\newcommand\skedmaketitle{%
  \ifsked@dstu\sked@title@dstu\else\ifsked@apa\sked@title@apa\else\sked@title@ieee\fi\fi}

\newcommand\sked@title@ieee{%
  \thispagestyle{empty}%
  \begingroup\centering
  \vspace*{12mm}%
  {\color{skedaccent}\rule{\textwidth}{1.2pt}}\par\vspace{9mm}
  {\color{skedaccent}\LARGE\bfseries\setstretch{1.15}\sked@title\par}%
  \ifdefempty{\sked@subtitle}{}{\vspace{5mm}{\large\itshape\sked@subtitle\par}}%
  \vspace{8mm}{\color{skedaccent}\rule{\textwidth}{1.2pt}}\par
  \vspace{10mm}%
  \ifdefempty{\sked@doctype}{}{{\large\itshape\sked@doctype\par}\vspace{7mm}}%
  \begin{tabular}{@{}r@{\hspace{0.8em}}l@{}}
    \sked@metarowx{\sked@s{author}}{\sked@author}
    \sked@metarowx{\sked@s{affiliation}}{\sked@affiliation}
    \sked@metarowx{\sked@s{version}}{\sked@version}
    \sked@metarowx{\sked@s{date}}{\sked@date}
    \sked@metarowx{\sked@s{platform}}{\sked@platform}
  \end{tabular}\par
  \vspace{12mm}%
  \endgroup}

\newcommand\sked@title@dstu{%
  \thispagestyle{empty}%
  \begingroup\centering\setstretch{1.2}%
  \ifdefempty{\sked@organization}{}{{\MakeUppercase{\sked@organization}\par}}%
  \vspace{12mm}%
  \ifdefempty{\sked@udc}{}{{\raggedright\sked@s{udc}~\sked@udc\par}}%
  \vfill
  \ifdefempty{\sked@doctype}{}{{\bfseries\MakeUppercase{\sked@doctype}\par}\vspace{6mm}}%
  {\bfseries\MakeUppercase{\sked@title}\par}%
  \ifdefempty{\sked@subtitle}{}{\vspace{3mm}{\sked@subtitle\par}}%
  \vfill
  \ifdefempty{\sked@author}{}{%
    \begin{tabular}{@{}p{0.42\textwidth}p{0.22\textwidth}p{0.3\textwidth}@{}}
      \sked@authorlabel & \rule{0.2\textwidth}{0.4pt} & \sked@author\\
    \end{tabular}\par}%
  \vfill
  {\ifdefempty{\sked@city}{}{\sked@city{} }\sked@year\par}%
  \endgroup
  \clearpage}
\newcommand\sked@year{\the\year}
\newcommand\skedyear[1]{\renewcommand\sked@year{#1}}

\newcommand\sked@title@apa{%
  \begingroup\centering
  \vspace*{0.22\textheight}%
  {\bfseries\sked@title\par}%
  \ifdefempty{\sked@subtitle}{}{{\bfseries\sked@subtitle\par}}%
  \vspace{2\baselineskip}%
  \ifdefempty{\sked@author}{}{\sked@author\par}%
  \ifdefempty{\sked@affiliation}{}{\sked@affiliation\par}%
  \ifdefempty{\sked@doctype}{}{\sked@doctype\par}%
  \sked@date\par
  \endgroup
  \clearpage}

% ------------------------------------------------------------ abstract
\renewenvironment{abstract}{\begin{skedabstract}}{\end{skedabstract}}
\newenvironment{skedabstract}{%
  \ifsked@dstu
    \section*{\sked@sp{abstract}}%
    \noindent\sked@doctype\ifdefempty{\sked@doctype}{}{:~}\skedstats.\par
  \else\ifsked@apa
    {\centering\bfseries\sked@sp{abstract}\par}\setlength{\parindent}{0pt}%
  \else
    \begingroup\centering\small\bfseries\sked@sp{abstract}\par\endgroup\vspace{0.4em}%
    \begin{list}{}{\leftmargin=8mm\rightmargin=8mm}\item\relax\small
  \fi\fi}{%
  \ifsked@dstu
    \ifdefempty{\sked@keywords}{}{\par\MakeUppercase{\sked@keywords}\par}%
    \clearpage
  \else\ifsked@apa
    \ifdefempty{\sked@keywords}{}{\par\hspace*{12.7mm}\textit{\sked@s{keywords}:} \sked@keywords\par}%
    \clearpage
  \else
    \ifdefempty{\sked@keywords}{}{\par\smallskip\textit{\sked@s{keywords}:} \sked@keywords\par}%
    \end{list}%
  \fi\fi}

% ------------------------------------------------------------ bibliography
\newcommand\sked@bibheading{%
  \ifsked@dstu
    \clearpage\section*{\sked@sp{refs}}\addcontentsline{toc}{section}{\sked@sp{refs}}%
  \else
    \section*{\sked@sp{refs}}\addcontentsline{toc}{section}{\sked@sp{refs}}%
  \fi}
\ifsked@apa
  \renewcommand\bibsection{\sked@bibheading}
  \setlength{\bibhang}{12.7mm}
  \setlength{\bibsep}{0.3em}
\else
  \renewenvironment{thebibliography}[1]
    {\sked@bibheading
     \list{\@biblabel{\@arabic\c@enumiv}}%
          {\settowidth\labelwidth{\@biblabel{#1}}%
           \leftmargin\labelwidth
           \advance\leftmargin\labelsep
           \@openbib@code
           \usecounter{enumiv}%
           \let\p@enumiv\@empty
           \renewcommand\theenumiv{\@arabic\c@enumiv}}%
     \sloppy
     \clubpenalty4000
     \@clubpenalty\clubpenalty
     \widowpenalty4000%
     \sfcode`\.\@m}
    {\def\@noitemerr{\@latex@warning{Empty `thebibliography' environment}}%
     \endlist}
  \ifsked@dstu\renewcommand\@biblabel[1]{#1.}\fi
\fi
\newcommand\skedbibliography{%
  \IfFileExists{references.tex}{\input{references.tex}}{%
    \ClassWarning{skedreport}{references.tex not found: run bibfmt.py (build.py does it)}}}

% ------------------------------------------------------------ appendices
\newcommand\skedappendix{%
  \clearpage
  \setcounter{section}{0}%
  \renewcommand\thesection{\Asbuk{section}}%
  \ifdefstring{\sked@key}{en}{\renewcommand\thesection{\Alph{section}}}{}%
  \titleformat{\section}[display]{\normalfont\bfseries\centering}{\sked@s{appendix}~\thesection}{0.4em}{}}
\providecommand\Asbuk[1]{\expandafter\@Asbuk\csname c@#1\endcsname}
\providecommand\@Asbuk[1]{\ifcase#1\or А\or Б\or В\or Г\or Д\or Е\or Ж\or И\or К\or Л\or М\or Н\or П\or Р\or С\or Т\or У\or Ф\or Х\or Ц\or Ш\or Щ\or Ю\or Я\else\@ctrerr\fi}

% ------------------------------------------------------------ links (load last)
\RequirePackage{xurl}
\RequirePackage{hyperref}
\ifsked@ieee
  \hypersetup{colorlinks=true,linkcolor=skedaccent,citecolor=skedaccent2,urlcolor=skedaccent2}
\else
  \hypersetup{colorlinks=true,linkcolor=black,citecolor=black,urlcolor=black}
\fi
\hypersetup{bookmarksnumbered=true,unicode=true}
\urlstyle{same}

\endinput
