"use strict";
/**
 * converter.js – DOM → LaTeX conversion.
 *
 * Converts an HTML DOM tree (produced by jsdom) to a LaTeX string.
 * Supported elements:
 *   headings (h1–h6), paragraphs, line-breaks, horizontal rules
 *   strong/b, em/i, u, s/del/strike, sup, sub
 *   inline code, pre/code blocks (verbatim), mermaid code blocks → TikZ stubs
 *   blockquote
 *   ul/ol/li (nested lists supported)
 *   table (with caption and auto-generated labels)
 *   figure/figcaption, img (standalone and in figure)
 *   a (tiddler cross-references, external \href, footnotes)
 *   KaTeX/MathJax math spans & divs (annotation element used for TeX source)
 *   MathML <math> (via TeX annotation)
 *   script, style, svg – skipped
 */

const { esc, escPath, escUrl } = require("./escape");

/* ── label counters ──────────────────────────────────────────────────── */

const _labelCounters = {};

function resetCounters() {
	Object.keys(_labelCounters).forEach(k => delete _labelCounters[k]);
}

function nextLabel(prefix) {
	_labelCounters[prefix] = (_labelCounters[prefix] || 0) + 1;
	return prefix + _labelCounters[prefix];
}

/* ── math helpers ────────────────────────────────────────────────────── */

function mathAnnotation(node) {
	const ann = node.querySelector("annotation[encoding='application/x-tex']");
	return ann ? ann.textContent : null;
}

function hasOwnEnv(latex) {
	return /^\\begin\{(equation|align|gather|multline|flalign|alignat|eqnarray)[*]?\}/.test(
		latex.trim()
	);
}

function displayMath(latex) {
	if(!latex) return "";
	if(hasOwnEnv(latex)) return "\n" + latex + "\n\n";
	if(/\\label\{/.test(latex)) {
		return "\n\\begin{equation}\n" + latex + "\n\\end{equation}\n\n";
	}
	return "\n\\[\n" + latex + "\n\\]\n\n";
}

function inlineMath(latex) {
	if(!latex) return "";
	return "$" + latex + "$";
}

/* ── table ───────────────────────────────────────────────────────────── */

function convertTable(tableNode, printList) {
	const rows = Array.from(tableNode.querySelectorAll("tr"));
	if(!rows.length) return "";

	let colCount = 0;
	Array.from(rows[0].querySelectorAll("th,td")).forEach(cell => {
		colCount += parseInt(cell.getAttribute("colspan") || "1", 10);
	});
	if(colCount === 0) colCount = 1;

	const colSpec = Array.from({length: colCount}, () => "l").join("|");
	let result = "\n\\begin{table}[h!]\n\\centering\n\\begin{tabular}{|" + colSpec + "|}\n\\hline\n";

	rows.forEach(row => {
		const cells = Array.from(row.querySelectorAll("th,td"));
		let line;
		if(cells.length && cells[0].tagName.toLowerCase() === "th") {
			line = cells.map(cell => "\\textbf{" + nodeToLatex(cell, printList).trim() + "}").join(" & ");
		} else {
			line = cells.map(cell => nodeToLatex(cell, printList).trim()).join(" & ");
		}
		result += line + " \\\\\n\\hline\n";
	});

	result += "\\end{tabular}\n";
	const caption = tableNode.querySelector("caption");
	const captionText = caption ? esc(caption.textContent) : "";
	result += "\\caption{" + captionText + "}\n";
	result += "\\label{" + nextLabel("tab:") + "}\n\\end{table}\n";
	return result;
}

/* ── figures / images ────────────────────────────────────────────────── */

function convertFigure(figureNode, printList) {
	const imgEl = figureNode.querySelector("img");
	const captionEl = figureNode.querySelector("figcaption");
	const caption = captionEl ? esc(captionEl.textContent) : "";
	const src = imgEl ? escPath(imgEl.getAttribute("src") || "") : "";
	const alt = imgEl ? esc(imgEl.getAttribute("alt") || "") : "";
	return "\n\\begin{figure}[h!]\n\\centering\n" +
		"\\includegraphics[width=0.8\\linewidth]{" + src + "}\n" +
		"\\caption{" + (caption || alt) + "}\n" +
		"\\label{" + nextLabel("fig:") + "}\n\\end{figure}\n";
}

function convertImg(imgNode) {
	const src = escPath(imgNode.getAttribute("src") || "");
	const alt = esc(imgNode.getAttribute("alt") || "");
	if(!src) return "";
	return "\n\\begin{figure}[h!]\n\\centering\n" +
		"\\includegraphics[width=0.8\\linewidth]{" + src + "}\n" +
		"\\caption{" + alt + "}\n" +
		"\\label{" + nextLabel("fig:") + "}\n\\end{figure}\n";
}

/* ── mermaid → TikZ stub ─────────────────────────────────────────────── */

function mermaidStub(src) {
	return "\n% Mermaid diagram – replace with TikZ:\n" +
		"\\begin{tikzpicture}\n" +
		"% " + src.replace(/\n/g, "\n% ") + "\n" +
		"% TODO: convert mermaid to TikZ\n" +
		"\\end{tikzpicture}\n\n";
}

/* ── core DOM walker ─────────────────────────────────────────────────── */

/**
 * Recursively convert a DOM node to a LaTeX string.
 *
 * @param {Node}     node       - the DOM node to convert
 * @param {string[]} printList  - titles in the export (for cross-references)
 * @param {Object}   [ctx]      - optional context object for mermaid blocks
 * @returns {string}
 */
function nodeToLatex(node, printList, ctx) {
	if(node.nodeType === 3) return esc(node.textContent); // TEXT_NODE
	if(node.nodeType !== 1) return "";                     // not ELEMENT_NODE

	const tag = node.tagName.toLowerCase();
	const children = () =>
		Array.from(node.childNodes).map(n => nodeToLatex(n, printList, ctx)).join("");

	switch(tag) {
		/* structure */
		case "h1": return "\n\\section{" + children() + "}\n";
		case "h2": return "\n\\subsection{" + children() + "}\n";
		case "h3": return "\n\\subsubsection{" + children() + "}\n";
		case "h4": return "\n\\paragraph{" + children() + "}\n";
		case "h5": return "\n\\subparagraph{" + children() + "}\n";
		case "h6": return "\n\\textbf{" + children() + "}\n\n";
		case "p":  return "\n" + children() + "\n";
		case "br": return "\\\\\n";
		case "hr": return "\n\\hrulefill\n\n";

		/* inline formatting */
		case "strong": case "b":  return "\\textbf{" + children() + "}";
		case "em":     case "i":  return "\\textit{" + children() + "}";
		case "u":                 return "\\underline{" + children() + "}";
		case "s": case "strike": case "del": return "\\sout{" + children() + "}";
		case "sup": return "\\textsuperscript{" + children() + "}";
		case "sub": return "\\textsubscript{" + children() + "}";

		/* code */
		case "code":
			if(node.parentNode && node.parentNode.tagName.toLowerCase() === "pre") {
				return node.textContent;
			}
			return "\\texttt{" + esc(node.textContent) + "}";

		case "pre": {
			const codeEl = node.querySelector("code");
			const rawContent = codeEl ? codeEl.textContent : node.textContent;
			const isMermaid = (codeEl && codeEl.classList.contains("language-mermaid")) ||
			                  node.classList.contains("mermaid");
			if(isMermaid) return mermaidStub(rawContent.trim());
			return "\n\\begin{verbatim}\n" + rawContent + "\n\\end{verbatim}\n";
		}

		/* blockquote */
		case "blockquote":
			return "\n\\begin{quote}\n" + children() + "\n\\end{quote}\n";

		/* lists */
		case "ul": return "\n\\begin{itemize}\n" + children() + "\\end{itemize}\n";
		case "ol": return "\n\\begin{enumerate}\n" + children() + "\\end{enumerate}\n";
		case "li": return "\\item " + children().trim() + "\n";

		/* table */
		case "table": return convertTable(node, printList);

		/* figures / images */
		case "figure": return convertFigure(node, printList);
		case "img":
			if(node.parentNode && node.parentNode.tagName.toLowerCase() === "figure") return "";
			return convertImg(node);

		/* links */
		case "a": {
			const href = node.getAttribute("href") || "";
			const linkText = children();
			const tiddlerTitle = node.getAttribute("data-tw-tiddler") ||
			                     (href.startsWith("#") ? decodeURIComponent(href.slice(1)) : null);
			if(tiddlerTitle && printList.includes(tiddlerTitle)) {
				return "\\hyperref[" + titleToLabel(tiddlerTitle) + "]{" + linkText + "}";
			}
			if(tiddlerTitle) {
				return linkText + "\\footnote{Tiddler: " + esc(tiddlerTitle) + "}";
			}
			if(href && href.includes("://")) {
				return "\\href{" + escUrl(href) + "}{" + linkText + "}";
			}
			return linkText;
		}

		/* KaTeX / MathJax */
		case "span": {
			if(node.classList.contains("katex-display")) return displayMath(mathAnnotation(node));
			if(node.classList.contains("katex")) {
				const parentCls = node.parentNode && node.parentNode.classList;
				if(parentCls && parentCls.contains("katex-display")) return "";
				const ann = mathAnnotation(node);
				return ann ? inlineMath(ann) : children();
			}
			return children();
		}

		case "div": {
			if(node.classList.contains("katex-display") || node.classList.contains("katex")) {
				return displayMath(mathAnnotation(node));
			}
			if(node.classList.contains("mermaid")) {
				if(ctx && Array.isArray(ctx.mermaidBlocks)) {
					const src = ctx.mermaidBlocks[ctx.mermaidIdx] || "";
					ctx.mermaidIdx++;
					if(src) return mermaidStub(src);
				}
			}
			return children();
		}

		/* MathML */
		case "math": {
			const ann = mathAnnotation(node);
			if(ann) {
				return node.getAttribute("display") === "block" ? displayMath(ann) : inlineMath(ann);
			}
			return children();
		}

		/* skip non-content */
		case "script": case "style": case "svg": return "";

		default: return children();
	}
}

/* ── title → label ───────────────────────────────────────────────────── */

function titleToLabel(title) {
	return "sec:" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

module.exports = { nodeToLatex, titleToLabel, resetCounters };
