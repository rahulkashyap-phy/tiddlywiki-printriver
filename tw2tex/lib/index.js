"use strict";
/**
 * index.js – public API for tw2tex.
 *
 * Usage (programmatic):
 *
 *   const { convertTiddlers } = require("tw2tex");
 *
 *   const tex = convertTiddlers(tiddlers, {
 *     documentclass: "article",
 *     paper:         "a4paper",
 *     fontsize:      "11pt",
 *     extraPreamble: "\\usepackage{minted}",
 *   });
 *
 *   require("fs").writeFileSync("output.tex", tex, "utf8");
 */

const { JSDOM }         = require("jsdom");
const { marked }        = require("marked");

const { nodeToLatex, titleToLabel, resetCounters } = require("./converter");
const { buildPreamble, buildDocument }              = require("./templates");
const { esc }                                       = require("./escape");

/* ── mermaid block extractor ─────────────────────────────────────────── */

function extractMermaidBlocks(rawText) {
	if(!rawText) return [];
	const blocks = [];
	const fenceRe = /```mermaid\r?\n([\s\S]*?)```/g;
	let m;
	while((m = fenceRe.exec(rawText)) !== null) {
		blocks.push(m[1].trim());
	}
	return blocks;
}

/* ── tiddler body → HTML ─────────────────────────────────────────────── */

/**
 * Render a tiddler's text body to HTML.
 * Supports plain Markdown (default) and passes raw HTML through unchanged.
 */
function renderBodyToHtml(tiddler) {
	const type = tiddler.type || "";
	const text = tiddler.text || "";

	// Raw HTML types
	if(type === "text/html") return text;

	// Markdown (tiddlywiki/markdown, text/x-markdown, text/markdown, or plain/default)
	return marked.parse(text);
}

/* ── tiddler → LaTeX section ─────────────────────────────────────────── */

/**
 * Convert a single tiddler object to a LaTeX section string.
 *
 * @param {Object}   tiddler
 * @param {string[]} printList   - all titles in the export (for cross-refs)
 * @param {string}   docClass    - document class (affects section command)
 * @param {boolean}  showTitle   - whether to emit a \section heading
 * @returns {string}
 */
function tiddlerToLatex(tiddler, printList, docClass, showTitle) {
	const title   = tiddler.title || "";
	const label   = titleToLabel(title);
	const rawText = tiddler.text || "";

	// Mermaid blocks from raw text (order-preserving)
	const mermaidBlocks = extractMermaidBlocks(rawText);
	const ctx = { mermaidBlocks, mermaidIdx: 0 };

	// Render body to HTML then parse into a DOM
	const html     = renderBodyToHtml(tiddler);
	const dom      = new JSDOM("<!DOCTYPE html><body>" + html + "</body>");
	const bodyEl   = dom.window.document.body;

	const content  = nodeToLatex(bodyEl, printList, ctx);

	// Section heading
	let heading;
	if(showTitle !== false) {
		const sectionCmd = (docClass === "book" || docClass === "report")
			? "\\chapter"
			: "\\section";
		heading = "\n" + sectionCmd + "{" + esc(title) + "}\\label{" + label + "}\n\n";
	} else {
		heading = "\n\\phantomsection\\label{" + label + "}\n\n";
	}

	return heading + content + "\n";
}

/* ── public API ──────────────────────────────────────────────────────── */

/**
 * Convert an ordered array of tiddler objects to a full LaTeX document string.
 *
 * @param {Object[]} tiddlers   - array of tiddler objects (must have .title and .text)
 * @param {Object}  [options]   - passed to buildPreamble(); see templates.js
 * @returns {string}  complete .tex file content
 */
function convertTiddlers(tiddlers, options) {
	resetCounters();

	options = options || {};
	const docClass  = options.documentclass || "article";
	const printList = tiddlers.map(t => t.title || "");
	const preamble  = buildPreamble(options);

	const sections = tiddlers.map(t =>
		tiddlerToLatex(t, printList, docClass, options.showTitles !== false)
	);

	return buildDocument(preamble, sections);
}

module.exports = {
	convertTiddlers,
	tiddlerToLatex,
	renderBodyToHtml,
};
