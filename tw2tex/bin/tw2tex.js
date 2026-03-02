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
 *   -h, --help                   Show this help and exit
 */

const fs   = require("fs");
const path = require("path");

const { parseTidFiles } = require("../lib/tid-parser");
const { convertTiddlers } = require("../lib/index");

/* ── argument parsing (no external deps) ────────────────────────────── */

function printHelp() {
	console.log(`
tw2tex – Convert TiddlyWiki .tid files to LaTeX

Usage:
  tw2tex [options] file1.tid [file2.tid ...]
  tw2tex [options] --glob "notes/**/*.tid"

Options:
  -o, --output <file>     Write output to <file> instead of stdout
  --class  <class>        LaTeX document class  [default: article]
  --paper  <paper>        Paper size option      [default: a4paper]
  --size   <size>         Font size option       [default: 11pt]
  --preamble <file>       Append contents of <file> to LaTeX preamble
  --no-titles             Suppress \\section headings
  --glob   <pattern>      Glob pattern for input .tid files
  -h, --help              Show this help

Example:
  tw2tex --output thesis.tex chapters/*.tid
  tw2tex --class book --paper a4paper --size 12pt intro.tid body.tid
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
	};

	for(let i = 0; i < args.length; i++) {
		const a = args[i];
		if(a === "-h" || a === "--help") { printHelp(); process.exit(0); }
		else if(a === "-o" || a === "--output")   opts.output   = args[++i];
		else if(a === "--class")                  opts.class    = args[++i];
		else if(a === "--paper")                  opts.paper    = args[++i];
		else if(a === "--size")                   opts.size     = args[++i];
		else if(a === "--preamble")               opts.preamble = args[++i];
		else if(a === "--glob")                   opts.glob     = args[++i];
		else if(a === "--no-titles")              opts.showTitles = false;
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

	// Output
	if(opts.output) {
		fs.writeFileSync(path.resolve(opts.output), latex, "utf8");
		console.error(`tw2tex: wrote ${path.resolve(opts.output)}`);
	} else {
		process.stdout.write(latex);
	}
}

main();
