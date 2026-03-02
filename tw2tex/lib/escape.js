"use strict";
/**
 * escape.js – single-pass LaTeX character escaping.
 *
 * Three helpers are exported:
 *   esc(text)       general text escaping
 *   escPath(path)   for \includegraphics{} paths
 *   escUrl(url)     for \href{}{} URLs
 */

/**
 * Escape characters that are special in LaTeX.
 * Single-pass regex switch prevents double-escaping.
 */
function esc(text) {
	if(!text) return "";
	return String(text).replace(/[\\{}$&%#_^~<>]/g, function(ch) {
		switch(ch) {
			case "\\": return "\\textbackslash{}";
			case "{":  return "\\{";
			case "}":  return "\\}";
			case "$":  return "\\$";
			case "&":  return "\\&";
			case "%":  return "\\%";
			case "#":  return "\\#";
			case "_":  return "\\_";
			case "^":  return "\\textasciicircum{}";
			case "~":  return "\\textasciitilde{}";
			case "<":  return "\\textless{}";
			case ">":  return "\\textgreater{}";
			default:   return ch;
		}
	});
}

/**
 * Minimal escaping for file-system paths inside \includegraphics{}.
 * Only characters that are special even in a brace-delimited path argument.
 */
function escPath(p) {
	if(!p) return "";
	return String(p).replace(/[%#{}\\]/g, function(ch) {
		switch(ch) {
			case "%":  return "\\%";
			case "#":  return "\\#";
			case "{":  return "\\{";
			case "}":  return "\\}";
			case "\\": return "\\textbackslash{}";
			default:   return ch;
		}
	});
}

/**
 * Escape URLs for use inside \href{}{}.
 * Uses a single-pass replacement to avoid re-escaping characters introduced
 * by earlier substitutions.
 * - % → \% (prevents LaTeX treating it as a comment)
 * - \ → \textbackslash{} (prevents stray LaTeX commands)
 */
function escUrl(url) {
	if(!url) return "";
	return String(url).replace(/[\\%]/g, function(ch) {
		return ch === "\\" ? "\\textbackslash{}" : "\\%";
	});
}

module.exports = { esc, escPath, escUrl };
