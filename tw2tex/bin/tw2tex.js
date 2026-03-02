#!/usr/bin/env node
"use strict";
/**
 * tw2tex – CLI entry point.
 *
 * Usage:
 *   tw2tex [options] file1.tid [file2.tid ...]
 *   tw2tex [options] --glob "notes/**\/*.tid"
 *
 * Options:
 *   -o, --output <file>          Output .tex file (default: stdout)
 *   --class  <documentclass>     LaTeX document class (default: article)
 *   --paper  <papersize>         Paper size option   (default: a4paper)
 *   --size   <fontsize>          Font size option    (default: 11pt)
 *   --preamble <file>            File whose contents are appended to preamble
 *   --no-titles                  Omit \section headings
 *   --glob   <pattern>           Glob pattern for input files
 *   --compile                    Compile the .tex output to PDF with pdflatex
 *   --compiler <path>            Path to pdflatex (or set TW2TEX_COMPILER env var)
 *   --runs <n>                   Number of pdflatex passes (default 2)
 *   -h, --help                   Show this help and exit
 */

const fs   = require("fs");
const path = require("path");

const { parseTidFiles } = require("../lib/tid-parser");
const { convertTiddlers } = require("../lib/index");
const { compile, resolveCompiler } = require("../lib/compile");

/* ── argument parsing (no external deps) ────────────────────────────── */

function printHelp() {
	console.log(`
tw2tex – Convert TiddlyWiki .tid files to LaTeX / PDF

Usage:
  tw2tex [options] file1.tid [file2.tid ...]
  tw2tex [options] --glob "notes/**/*.tid"

Options:
  -o, --output <file>     Write .tex output to <file> (default: stdout)
  --class  <class>        LaTeX document class  [default: article]
  --paper  <paper>        Paper size option      [default: a4paper]
  --size   <size>         Font size option       [default: 11pt]
  --preamble <file>       Append contents of <file> to LaTeX preamble
  --no-titles             Suppress \\section headings
  --glob   <pattern>      Glob pattern for input .tid files
  --compile               Compile the .tex output to PDF (requires pdflatex)
  --compiler <path>       Path to pdflatex binary (see TeX compiler notes below)
  --runs <n>              Number of pdflatex passes  [default: 2]
  -h, --help              Show this help

TeX compiler – how to specify the path
  Priority: --compiler flag → TW2TEX_COMPILER env var → tw2tex.config.json → auto-detect

  macOS (MacTeX / BasicTeX):
    brew install --cask mactex          # full install  →  /Library/TeX/texbin/pdflatex
    brew install --cask basictex        # minimal       →  /Library/TeX/texbin/pdflatex
    tw2tex --compiler /Library/TeX/texbin/pdflatex ...
    # or: export TW2TEX_COMPILER=/Library/TeX/texbin/pdflatex

  Windows (MiKTeX):
    winget install MiKTeX.MiKTeX        # or https://miktex.org/download
    tw2tex --compiler "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe" ...
    # or: set TW2TEX_COMPILER=C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe

  Windows (TeX Live):
    # Installer from https://tug.org/texlive/
    tw2tex --compiler "C:\\texlive\\2024\\bin\\windows\\pdflatex.exe" ...

  Ubuntu / Debian:
    sudo apt-get install texlive-latex-extra   # or texlive-full
    # pdflatex lands in /usr/bin – auto-detected, no flag needed
    tw2tex --compiler /usr/bin/pdflatex ...

  Config file (tw2tex.config.json in project root):
    { "compiler": "/usr/local/texlive/2024/bin/x86_64-linux/pdflatex" }

Examples:
  tw2tex --output thesis.tex chapters/*.tid
  tw2tex --class book --paper a4paper --size 12pt intro.tid body.tid
  tw2tex --compile -o out/notes.tex notes/*.tid
  tw2tex --compile --compiler /Library/TeX/texbin/pdflatex -o thesis.tex *.tid
`);
}

function parseArgs(argv) {
	const args   = argv.slice(2);
	const opts   = {
		output:     null,
		class:      "article",
		paper:      "a4paper",
		size:       "11pt",
		preamble:   null,
		showTitles: true,
		glob:       null,
		files:      [],
		doCompile:  false,
		compiler:   null,
		runs:       2,
	};

	for(let i = 0; i < args.length; i++) {
		const a = args[i];
		if(a === "-h" || a === "--help") { printHelp(); process.exit(0); }
		else if(a === "-o" || a === "--output")   opts.output    = args[++i];
		else if(a === "--class")                  opts.class     = args[++i];
		else if(a === "--paper")                  opts.paper     = args[++i];
		else if(a === "--size")                   opts.size      = args[++i];
		else if(a === "--preamble")               opts.preamble  = args[++i];
		else if(a === "--glob")                   opts.glob      = args[++i];
		else if(a === "--no-titles")              opts.showTitles = false;
		else if(a === "--compile")                opts.doCompile = true;
		else if(a === "--compiler")               opts.compiler  = args[++i];
		else if(a === "--runs")                   opts.runs      = parseInt(args[++i], 10) || 2;
		else if(!a.startsWith("-"))               opts.files.push(a);
		else { console.error("Unknown option:", a); process.exit(1); }
	}
	return opts;
}

/* ── glob expansion ──────────────────────────────────────────────────── */

function expandGlob(pattern) {
	// Use a minimal built-in glob implementation for simple patterns, or
	// delegate to the 'glob' package if available.
	try {
		const { globSync } = require("glob");
		return globSync(pattern, { nodir: true });
	} catch(_e) {
		// Fall back to simple recursive *.tid search in the given directory
		const dir = pattern.replace(/\*.*$/, "") || ".";
		return collectTidFiles(dir);
	}
}

function collectTidFiles(dir) {
	const results = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for(const entry of entries) {
		const full = path.join(dir, entry.name);
		if(entry.isDirectory()) results.push(...collectTidFiles(full));
		else if(entry.name.endsWith(".tid")) results.push(full);
	}
	return results;
}

/* ── main ────────────────────────────────────────────────────────────── */

function main() {
	const opts = parseArgs(process.argv);

	// Collect input files
	let files = [...opts.files];
	if(opts.glob) files = files.concat(expandGlob(opts.glob));

	if(!files.length) {
		console.error("tw2tex: no input files specified. Use -h for help.");
		process.exit(1);
	}

	// Resolve relative paths
	files = files.map(f => path.resolve(f));

	// Parse tiddlers
	let tiddlers;
	try {
		tiddlers = parseTidFiles(files);
	} catch(err) {
		console.error("tw2tex: error reading tiddler files:", err.message);
		process.exit(1);
	}

	// Build conversion options
	const options = {
		documentclass: opts.class,
		paper:         opts.paper,
		fontsize:      opts.size,
		showTitles:    opts.showTitles,
		extraPreamble: "",
	};

	if(opts.preamble) {
		try {
			options.extraPreamble = fs.readFileSync(path.resolve(opts.preamble), "utf8").trim();
		} catch(err) {
			console.error("tw2tex: cannot read preamble file:", err.message);
			process.exit(1);
		}
	}

	// Convert
	let latex;
	try {
		latex = convertTiddlers(tiddlers, options);
	} catch(err) {
		console.error("tw2tex: conversion error:", err.message);
		console.error(err.stack);
		process.exit(1);
	}

	// Determine the .tex output path
	let texPath = opts.output ? path.resolve(opts.output) : null;

	// If --compile is set we must have a real file (not stdout)
	if(opts.doCompile && !texPath) {
		texPath = path.resolve("tw2tex-output.tex");
		console.error("tw2tex: --compile requires an output file; using " + texPath);
	}

	// Write the .tex file (or print to stdout)
	if(texPath) {
		fs.mkdirSync(path.dirname(texPath), { recursive: true });
		fs.writeFileSync(texPath, latex, "utf8");
		console.error("tw2tex: wrote " + texPath);
	} else {
		process.stdout.write(latex);
	}

	// Optionally compile to PDF
	if(opts.doCompile && texPath) {
		const compilerPath = resolveCompiler({ compiler: opts.compiler });
		console.error("tw2tex: compiling with " + compilerPath + " (" + opts.runs + " pass(es))…");

		const result = require("../lib/compile").compileTex(texPath, {
			compiler: compilerPath,
			runs:     opts.runs,
		});

		if(result.pdf) {
			console.error("tw2tex: PDF written to " + result.pdf);
		} else {
			console.error("tw2tex: compilation failed (exit " + result.exitCode + ")");
			if(result.log) console.error("tw2tex: see log at " + result.log);
			process.exit(result.exitCode || 1);
		}
	}
}

main();
