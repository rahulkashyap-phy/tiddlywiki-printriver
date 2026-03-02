"use strict";
/**
 * templates.js – assemble a complete LaTeX document from sections.
 *
 * Exported functions:
 *   buildPreamble(options) → string   (from \documentclass to \begin{document})
 *   buildDocument(preamble, sections) → string  (full .tex content)
 */

const SAFE_CLASSES = ["article","report","book","scrartcl","scrreprt","scrbook","memoir","beamer"];
const SAFE_PAPERS  = ["a4paper","a5paper","letterpaper","legalpaper","executivepaper","b5paper"];
const SAFE_SIZES   = ["8pt","9pt","10pt","11pt","12pt","14pt","17pt","20pt"];

/**
 * Build the LaTeX preamble (everything before \begin{document}).
 *
 * @param {Object} [options]
 * @param {string} [options.documentclass="article"]
 * @param {string} [options.paper="a4paper"]
 * @param {string} [options.fontsize="11pt"]
 * @param {string} [options.extraPreamble=""]  additional \usepackage / \newcommand lines
 * @returns {string}
 */
function buildPreamble(options) {
	options = options || {};
	const docClass = SAFE_CLASSES.includes(options.documentclass) ? options.documentclass : "article";
	const paper    = SAFE_PAPERS.includes(options.paper)          ? options.paper    : "a4paper";
	const fontSize = SAFE_SIZES.includes(options.fontsize)        ? options.fontsize : "11pt";
	const extraPre = (options.extraPreamble || "").trim();

	const lines = [
		`\\documentclass[${fontSize},${paper}]{${docClass}}`,
		"",
		"% ----- packages added by tw2tex -----",
		"\\usepackage[utf8]{inputenc}",
		"\\usepackage[T1]{fontenc}",
		"\\usepackage{amsmath,amssymb,amsthm}",
		"\\usepackage{graphicx}",
		"\\usepackage[colorlinks=true,linkcolor=blue,urlcolor=blue]{hyperref}",
		"\\usepackage{verbatim}",
		"\\usepackage[normalem]{ulem}",
		"\\usepackage{booktabs}",
		"\\usepackage{tikz}",
		"\\usepackage{xcolor}",
		""
	];

	if(extraPre) {
		lines.push("% ----- custom preamble -----");
		lines.push(extraPre);
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Assemble the full .tex document string.
 *
 * @param {string}   preamble  - result of buildPreamble()
 * @param {string[]} sections  - array of LaTeX section strings (one per tiddler)
 * @returns {string}
 */
function buildDocument(preamble, sections) {
	return preamble + "\n\\begin{document}\n" +
		sections.join("\n") +
		"\n\\end{document}\n";
}

module.exports = { buildPreamble, buildDocument };
