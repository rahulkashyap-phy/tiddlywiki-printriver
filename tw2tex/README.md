# tw2tex

Convert [TiddlyWiki](https://tiddlywiki.com) `.tid` files to compilable **LaTeX / PDF**.

`tw2tex` is the standalone Node.js successor to the LaTeX export feature built
into the [PrintRiver](https://github.com/rahulkashyap-phy/tiddlywiki-printriver)
TiddlyWiki plugin.  It runs entirely from the command line — no browser required.

---

## Features

| Content | LaTeX output |
|---|---|
| `!` `!!` `!!!` headings | `\section` / `\subsection` / `\subsubsection` |
| Bold / italic / underline / strikethrough | `\textbf` `\textit` `\underline` `\sout` |
| Fenced code blocks | `verbatim` environment |
| Mermaid code fences | `tikzpicture` stub + source as `%` comments |
| Tables (`<table>`) | `tabular` float with unique `\label{tab:N}` |
| Images / figures | `figure` float + `\includegraphics` |
| KaTeX/MathJax display math **with** `\label{}` | `equation` (numbered) |
| KaTeX/MathJax display math **without** label | `\[…\]` (unnumbered) |
| Existing `\begin{align}` / `equation` | passed through unchanged |
| Links to tiddlers in the export | `\hyperref[sec:…]{…}` cross-references |
| Links to tiddlers outside the export | plain text + `\footnote{}` |
| External URLs | `\href{…}{…}` |

---

## Installation

```bash
# global CLI
npm install -g tw2tex

# or as a project dependency
npm install tw2tex
```

---

## Quick start

```bash
# Convert one tiddler to stdout
tw2tex my-note.tid

# Convert several tiddlers to a file
tw2tex --output thesis.tex intro.tid methods.tid results.tid

# Convert and compile to PDF in one step
tw2tex --compile --output thesis.tex *.tid

# Book layout, A4, 12 pt
tw2tex --class book --paper a4paper --size 12pt --compile --output book.tex *.tid
```

---

## CLI reference

```
tw2tex [options] file1.tid [file2.tid ...]
tw2tex [options] --glob "notes/**/*.tid"

Options:
  -o, --output <file>     Write .tex to <file>  [default: stdout]
  --class  <class>        LaTeX document class  [default: article]
  --paper  <paper>        Paper size option     [default: a4paper]
  --size   <size>         Font size option      [default: 11pt]
  --preamble <file>       Prepend file contents to the LaTeX preamble
  --no-titles             Omit \section headings (tiddler titles)
  --glob   <pattern>      Glob pattern for input .tid files
  --compile               Compile the generated .tex to PDF
  --compiler <path>       Path to pdflatex binary (see §TeX compiler below)
  --runs <n>              pdflatex passes  [default: 2]
  -h, --help              Show help
```

---

## Programmatic API

```js
const { convertTiddlers } = require("tw2tex");
const fs = require("fs");

const tiddlers = [
  { title: "Introduction", text: "# Hello\n\nThis is **bold**." },
  { title: "Methods",      text: "## Section\n\nSome text." },
];

const tex = convertTiddlers(tiddlers, {
  documentclass: "article",
  paper:         "a4paper",
  fontsize:      "11pt",
  extraPreamble: "\\usepackage{minted}",
  showTitles:    true,
});

fs.writeFileSync("output.tex", tex, "utf8");
```

To also compile:

```js
const { compile } = require("tw2tex/lib/compile");

const result = compile(tex, "./out", {
  compiler: "/Library/TeX/texbin/pdflatex",   // optional
  runs: 2,
});

if(result.pdf) console.log("PDF:", result.pdf);
```

---

## TeX compiler — installation and path configuration

`tw2tex` uses `pdflatex` to compile `.tex` files to PDF.
The compiler path is resolved in this order:

1. **`--compiler <path>`** CLI flag  
2. **`TW2TEX_COMPILER`** environment variable  
3. **`tw2tex.config.json`** in the project root (or any parent directory)  
4. **Platform auto-detection** (see table below)

### macOS

**Install MacTeX** (full, ~4 GB):

```bash
brew install --cask mactex
# pdflatex lands at: /Library/TeX/texbin/pdflatex
```

**Install BasicTeX** (minimal, ~100 MB):

```bash
brew install --cask basictex
# same path: /Library/TeX/texbin/pdflatex
# install missing packages on demand:
sudo tlmgr update --self
sudo tlmgr install collection-latexrecommended
```

**Specify the path:**

```bash
# one-off
tw2tex --compiler /Library/TeX/texbin/pdflatex --compile -o out.tex *.tid

# per-session shell environment
export TW2TEX_COMPILER=/Library/TeX/texbin/pdflatex

# permanent (add to ~/.zshrc or ~/.bash_profile)
export TW2TEX_COMPILER=/Library/TeX/texbin/pdflatex
```

tw2tex auto-detects `/Library/TeX/texbin/pdflatex` on macOS, so no flag is
normally needed after a standard MacTeX / BasicTeX install.

---

### Windows

**Install MiKTeX** (recommended, auto-installs missing packages):

```powershell
winget install MiKTeX.MiKTeX
# or download the installer from https://miktex.org/download
# pdflatex lands at:
#   C:\Program Files\MiKTeX\miktex\bin\x64\pdflatex.exe   (64-bit)
#   C:\Program Files (x86)\MiKTeX\miktex\bin\pdflatex.exe (32-bit)
```

**Install TeX Live for Windows:**

Download the network installer from <https://tug.org/texlive/> and follow the
wizard.  Default install path:

```
C:\texlive\2024\bin\windows\pdflatex.exe
```

**Specify the path:**

```powershell
# one-off (Command Prompt)
tw2tex --compiler "C:\Program Files\MiKTeX\miktex\bin\x64\pdflatex.exe" --compile -o out.tex *.tid

# permanent (System or User environment variable via PowerShell)
[System.Environment]::SetEnvironmentVariable(
  "TW2TEX_COMPILER",
  "C:\Program Files\MiKTeX\miktex\bin\x64\pdflatex.exe",
  "User"
)

# or add MiKTeX's bin directory to your PATH
# (the MiKTeX installer usually does this automatically)
```

After adding MiKTeX to `PATH`, tw2tex will find `pdflatex.exe` automatically.

---

### Ubuntu / Debian Linux

**Install TeX Live (recommended):**

```bash
# Minimal install (~200 MB) – good for most documents
sudo apt-get install texlive-latex-extra

# Full install (~5 GB) – includes every package
sudo apt-get install texlive-full

# pdflatex lands at: /usr/bin/pdflatex  (auto-detected by tw2tex)
```

**Install specific TeX Live packages without the full suite:**

```bash
sudo apt-get install texlive-base texlive-latex-recommended texlive-fonts-recommended
```

**Fedora / RHEL / Rocky Linux:**

```bash
sudo dnf install texlive-scheme-medium   # or texlive-scheme-full
```

**User-local TeX Live install (any Linux):**

```bash
# Follow https://tug.org/texlive/quickinstall.html
# Typical install path:
/usr/local/texlive/2024/bin/x86_64-linux/pdflatex

# Add to PATH permanently (add to ~/.bashrc)
export PATH="/usr/local/texlive/2024/bin/x86_64-linux:$PATH"
```

**Specify the path:**

```bash
# one-off
tw2tex --compiler /usr/bin/pdflatex --compile -o out.tex *.tid

# per-session
export TW2TEX_COMPILER=/usr/bin/pdflatex

# permanent (add to ~/.bashrc)
export TW2TEX_COMPILER=/usr/bin/pdflatex
```

If pdflatex is on your `$PATH` (the apt install puts it there), tw2tex finds it
automatically — no flag needed.

---

### Config file (`tw2tex.config.json`)

Place a `tw2tex.config.json` in your project root (or any ancestor directory).
tw2tex searches upward from the input files' location.

```json
{
  "compiler": "/usr/local/texlive/2024/bin/x86_64-linux/pdflatex",
  "documentclass": "article",
  "paper": "a4paper",
  "fontsize": "11pt",
  "extraPreamble": "\\usepackage{minted}\n\\usepackage{csquotes}"
}
```

All fields are optional.  The `compiler` field takes the same value as
`--compiler` on the CLI or the `TW2TEX_COMPILER` environment variable.

---

## Equation labels (numbered equations)

To produce a numbered equation, include `\label{eq:…}` inside the display
math delimiters in your tiddler (TiddlyWiki or Markdown):

```markdown
$$\label{eq:energy} E = mc^2$$
```

This exports as:

```latex
\begin{equation}
\label{eq:energy} E = mc^2
\end{equation}
```

---

## Mermaid diagrams → TikZ

Mermaid fenced code blocks are exported as empty `tikzpicture` environments
with the original mermaid source preserved in comments:

```latex
% Mermaid diagram – replace with TikZ:
\begin{tikzpicture}
% graph LR
%   A --> B
% TODO: convert mermaid to TikZ
\end{tikzpicture}
```

Replace the stub with the equivalent TikZ code to include the diagram in the
compiled PDF.

---

## Compiling the exported file manually

```bash
pdflatex output.tex
pdflatex output.tex   # second pass resolves cross-references
```

Or with `latexmk` (auto-detects number of passes needed):

```bash
latexmk -pdf output.tex
```

---

## License

MIT © rahulkashyap-phy
