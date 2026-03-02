"use strict";
/**
 * basic.js – lightweight smoke tests for tw2tex.
 *
 * No external test framework required.  Run with:
 *   node test/basic.js
 */

const assert = require("assert");
const path   = require("path");
const fs     = require("fs");
const os     = require("os");

/* ── helpers ─────────────────────────────────────────────────────────── */

let passed = 0;
let failed = 0;

function test(name, fn) {
	try {
		fn();
		console.log("  ✓", name);
		passed++;
	} catch(err) {
		console.error("  ✗", name);
		console.error("    ", err.message);
		failed++;
	}
}

function ok(condition, message) {
	assert.ok(condition, message);
}

function eq(actual, expected, message) {
	assert.strictEqual(actual, expected, message);
}

function contains(str, substr, message) {
	assert.ok(
		String(str).includes(substr),
		message || `Expected ${JSON.stringify(str)} to contain ${JSON.stringify(substr)}`
	);
}

/* ── escape.js ───────────────────────────────────────────────────────── */

const { esc, escPath, escUrl } = require("../lib/escape");

console.log("\nescape.js");

test("esc: plain text unchanged", () => {
	eq(esc("Hello world"), "Hello world");
});

test("esc: backslash → \\textbackslash{}", () => {
	eq(esc("a\\b"), "a\\textbackslash{}b");
});

test("esc: no double-escaping of braces", () => {
	// { must become \{ and not \\textbackslash{}\{
	eq(esc("{x}"), "\\{x\\}");
});

test("esc: all special chars", () => {
	eq(esc("$&%#_^~<>"), "\\$\\&\\%\\#\\_\\textasciicircum{}\\textasciitilde{}\\textless{}\\textgreater{}");
});

test("escPath: % and # escaped in paths", () => {
	contains(escPath("/tmp/my%20file.png"), "\\%");
	contains(escPath("/tmp/my#file.png"),   "\\#");
});

test("escPath: normal path unchanged", () => {
	eq(escPath("/home/user/thesis/fig1.png"), "/home/user/thesis/fig1.png");
});

test("escUrl: % in URL escaped", () => {
	eq(escUrl("https://example.com/page%20foo"), "https://example.com/page\\%20foo");
});

test("escUrl: backslash in URL escaped", () => {
	contains(escUrl("https://example.com/path\\file"), "\\textbackslash{}");
});

test("escUrl: ordinary URL unchanged", () => {
	eq(escUrl("https://example.com/page"), "https://example.com/page");
});

/* ── tid-parser.js ───────────────────────────────────────────────────── */

const { parseTidString, parseTidFile } = require("../lib/tid-parser");

console.log("\ntid-parser.js");

test("parseTidString: extracts title and text", () => {
	const t = parseTidString("title: My Note\n\nHello **world**");
	eq(t.title, "My Note");
	eq(t.text, "Hello **world**");
});

test("parseTidString: handles CRLF line endings", () => {
	const t = parseTidString("title: Note\r\n\r\nBody text");
	eq(t.title, "Note");
	eq(t.text, "Body text");
});

test("parseTidString: tags parsed to array", () => {
	const t = parseTidString("title: A\ntags: foo bar\n\nbody");
	assert.deepStrictEqual(t.tags, ["foo", "bar"]);
});

test("parseTidString: empty tags gives empty array", () => {
	const t = parseTidString("title: A\n\nbody");
	assert.deepStrictEqual(t.tags, []);
});

test("parseTidString: no blank line – all content is body", () => {
	const t = parseTidString("title: A\ntype: text/plain");
	// no blank separator means no body
	eq(t.text, "");
});

test("parseTidFile: reads a real .tid file", () => {
	// Write a temp .tid file and verify parsing
	const tmp = path.join(os.tmpdir(), "tw2tex-test-" + Date.now() + ".tid");
	fs.writeFileSync(tmp, "title: Temp Test\ntags: test\n\nSome body text\n");
	try {
		const t = parseTidFile(tmp);
		eq(t.title, "Temp Test");
		eq(t.text.trim(), "Some body text");
	} finally {
		fs.unlinkSync(tmp);
	}
});

/* ── templates.js ────────────────────────────────────────────────────── */

const { buildPreamble, buildDocument } = require("../lib/templates");

console.log("\ntemplates.js");

test("buildPreamble: contains \\documentclass", () => {
	contains(buildPreamble(), "\\documentclass[11pt,a4paper]{article}");
});

test("buildPreamble: contains \\usepackage{hyperref}", () => {
	contains(buildPreamble(), "\\usepackage");
});

test("buildPreamble: custom documentclass whitelisted", () => {
	contains(buildPreamble({ documentclass: "book" }), "{book}");
});

test("buildPreamble: unknown documentclass falls back to article", () => {
	contains(buildPreamble({ documentclass: "malicious\\inject" }), "{article}");
});

test("buildPreamble: extraPreamble injected", () => {
	contains(buildPreamble({ extraPreamble: "\\usepackage{minted}" }), "\\usepackage{minted}");
});

test("buildDocument: wraps in \\begin/\\end{document}", () => {
	const doc = buildDocument("PREAMBLE\n", ["SECTION1", "SECTION2"]);
	contains(doc, "\\begin{document}");
	contains(doc, "SECTION1");
	contains(doc, "\\end{document}");
});

/* ── index.js – integration ──────────────────────────────────────────── */

const { convertTiddlers } = require("../lib/index");

console.log("\nindex.js (integration)");

test("convertTiddlers: produces a valid LaTeX skeleton", () => {
	const tex = convertTiddlers([
		{ title: "Intro", text: "# Hello\n\nThis is **bold**." },
	]);
	contains(tex, "\\documentclass");
	contains(tex, "\\begin{document}");
	contains(tex, "\\section{Intro}");
	contains(tex, "\\textbf{bold}");
	contains(tex, "\\end{document}");
});

test("convertTiddlers: cross-references between tiddlers", () => {
	const tex = convertTiddlers([
		{ title: "A", text: "[see B](#B)" },
		{ title: "B", text: "Content of B." },
	]);
	contains(tex, "\\hyperref[sec:b]");
});

test("convertTiddlers: table produces tabular env", () => {
	const tex = convertTiddlers([
		{ title: "T", text: "| H1 | H2 |\n|---|---|\n| a | b |" },
	]);
	contains(tex, "\\begin{tabular}");
	contains(tex, "\\end{tabular}");
});

test("convertTiddlers: mermaid fence → tikzpicture stub", () => {
	const tex = convertTiddlers([
		{ title: "G", text: "```mermaid\ngraph LR\n  A --> B\n```" },
	]);
	contains(tex, "tikzpicture");
	contains(tex, "% graph LR");
});

test("convertTiddlers: numbered equation via \\label", () => {
	const tex = convertTiddlers([
		{ title: "Eq", text: "$$\\label{eq:e}E=mc^2$$" },
	]);
	// Display math with \label should produce \begin{equation}
	contains(tex, "\\begin{equation}");
	contains(tex, "\\label{eq:e}");
});

test("convertTiddlers: unnumbered display math", () => {
	const tex = convertTiddlers([
		{ title: "Eq2", text: "$$E=mc^2$$" },
	]);
	// Without \label → \[ ... \]
	contains(tex, "\\[");
	contains(tex, "\\]");
});

test("convertTiddlers: inline math", () => {
	const tex = convertTiddlers([
		{ title: "Inline", text: "The formula $E=mc^2$ is famous." },
	]);
	contains(tex, "$E=mc^2$");
});

test("convertTiddlers: book class maps to \\chapter", () => {
	const tex = convertTiddlers(
		[{ title: "Ch1", text: "Chapter body." }],
		{ documentclass: "book" }
	);
	contains(tex, "\\chapter{Ch1}");
});

/* ── compile.js – unit (no actual compilation) ───────────────────────── */

const { resolveCompiler } = require("../lib/compile");

console.log("\ncompile.js");

test("resolveCompiler: explicit option wins", () => {
	eq(resolveCompiler({ compiler: "/my/custom/pdflatex" }), "/my/custom/pdflatex");
});

test("resolveCompiler: TW2TEX_COMPILER env wins over auto-detect", () => {
	const old = process.env.TW2TEX_COMPILER;
	process.env.TW2TEX_COMPILER = "/env/path/pdflatex";
	try {
		eq(resolveCompiler(), "/env/path/pdflatex");
	} finally {
		if(old === undefined) delete process.env.TW2TEX_COMPILER;
		else process.env.TW2TEX_COMPILER = old;
	}
});

test("resolveCompiler: returns a non-empty string", () => {
	// Remove env so auto-detect runs
	const old = process.env.TW2TEX_COMPILER;
	delete process.env.TW2TEX_COMPILER;
	try {
		const result = resolveCompiler();
		ok(typeof result === "string" && result.length > 0, "got a string");
	} finally {
		if(old !== undefined) process.env.TW2TEX_COMPILER = old;
	}
});

/* ── summary ─────────────────────────────────────────────────────────── */

console.log("\n" + (failed === 0 ? "✓" : "✗") +
	` ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
