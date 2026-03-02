"use strict";
/**
 * compile.js – invoke a local LaTeX compiler to produce a PDF.
 *
 * Resolution order for the compiler executable
 * ─────────────────────────────────────────────
 * 1. The `compiler` option passed directly to compile() / compileTex()
 * 2. The TW2TEX_COMPILER environment variable
 * 3. The `compiler` field in the nearest tw2tex.config.json file
 *    (searched from cwd upward toward the filesystem root)
 * 4. Platform defaults:
 *      macOS   → /Library/TeX/texbin/pdflatex
 *      Windows → C:\Program Files\MiKTeX\miktex\bin\x64\pdflatex.exe
 *                (then C:\texlive\2024\bin\windows\pdflatex.exe)
 *      Linux   → pdflatex (resolved via PATH)
 *
 * Exported functions
 * ──────────────────
 *   resolveCompiler([options]) → string   path to the pdflatex binary
 *   compileTex(texFile, [options]) → Promise<{ pdf, log, stdout, stderr }>
 *   compile(latexString, outDir, [options]) → Promise<{ pdf, log, stdout, stderr }>
 *
 * Options recognised by compileTex / compile
 * ───────────────────────────────────────────
 *   compiler   string   explicit path or name of the latex binary
 *   runs       number   number of passes (default 2, for cross-refs)
 *   quiet      bool     suppress compiler stdout (default false)
 *   configFile string   explicit path to tw2tex.config.json
 */

const fs      = require("fs");
const os      = require("os");
const path    = require("path");
const { spawnSync } = require("child_process");

/* ── Platform defaults ──────────────────────────────────────────────── */

/**
 * Ordered list of candidate compiler paths for each platform.
 * tw2tex tries each one and returns the first that exists.
 *
 * macOS
 *   MacTeX installs to /Library/TeX/texbin (symlink farm)
 *   Homebrew BasicTeX uses the same path
 *
 * Windows
 *   MiKTeX default install (both 64-bit and 32-bit)
 *   TeX Live default installs for recent years
 *
 * Linux
 *   TeX Live via apt/dnf lands in /usr/bin
 *   User-local TeX Live installs typically add to PATH
 */
const PLATFORM_DEFAULTS = {
	darwin: [
		"/Library/TeX/texbin/pdflatex",
		"/usr/local/texlive/2024/bin/universal-darwin/pdflatex",
		"/usr/local/texlive/2023/bin/universal-darwin/pdflatex",
		"/usr/local/bin/pdflatex",
	],
	win32: [
		"C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
		"C:\\Program Files (x86)\\MiKTeX\\miktex\\bin\\pdflatex.exe",
		"C:\\texlive\\2024\\bin\\windows\\pdflatex.exe",
		"C:\\texlive\\2023\\bin\\windows\\pdflatex.exe",
		"C:\\texlive\\2022\\bin\\windows\\pdflatex.exe",
		"pdflatex.exe",   // hope it's on PATH
	],
	linux: [
		"/usr/bin/pdflatex",
		"/usr/local/bin/pdflatex",
		"pdflatex",       // resolve via PATH
	],
};

/* ── Config file search ──────────────────────────────────────────────── */

/**
 * Walk up from `startDir` looking for tw2tex.config.json.
 * Returns the parsed object, or {} if not found.
 */
function findConfig(startDir, explicitPath) {
	if(explicitPath) {
		try {
			return JSON.parse(fs.readFileSync(explicitPath, "utf8"));
		} catch(_e) {
			return {};
		}
	}

	let dir = path.resolve(startDir || process.cwd());
	const root = path.parse(dir).root;

	while(true) {
		const candidate = path.join(dir, "tw2tex.config.json");
		if(fs.existsSync(candidate)) {
			try {
				return JSON.parse(fs.readFileSync(candidate, "utf8"));
			} catch(_e) {
				return {};
			}
		}
		if(dir === root) break;
		dir = path.dirname(dir);
	}
	return {};
}

/* ── Compiler resolution ─────────────────────────────────────────────── */

/**
 * Resolve the path to the LaTeX compiler.
 *
 * @param {Object}  [options]
 * @param {string}  [options.compiler]    explicit compiler path or name
 * @param {string}  [options.configFile]  explicit path to tw2tex.config.json
 * @param {string}  [options.cwd]         directory to start config search from
 * @returns {string}  compiler path (may be a bare name if trusting PATH)
 */
function resolveCompiler(options) {
	options = options || {};

	// 1. Explicit option
	if(options.compiler) return options.compiler;

	// 2. Environment variable
	if(process.env.TW2TEX_COMPILER) return process.env.TW2TEX_COMPILER;

	// 3. Config file
	const cfg = findConfig(options.cwd, options.configFile);
	if(cfg.compiler) return cfg.compiler;

	// 4. Platform defaults
	const platform = os.platform();
	const candidates = PLATFORM_DEFAULTS[platform] || PLATFORM_DEFAULTS["linux"];

	for(const c of candidates) {
		// Bare names (no path separator) are checked via which/where
		if(!c.includes(path.sep) && !c.includes("/")) {
			const which = spawnSync(
				process.platform === "win32" ? "where" : "which",
				[c],
				{ encoding: "utf8", stdio: "pipe" }
			);
			if(which.status === 0) return c;
		} else {
			if(fs.existsSync(c)) return c;
		}
	}

	// Last resort: hope pdflatex is on PATH
	return "pdflatex";
}

/* ── Compilation ─────────────────────────────────────────────────────── */

/**
 * Run pdflatex on an existing .tex file.
 *
 * @param {string}  texFile   absolute path to the .tex file
 * @param {Object}  [options]
 * @param {string}  [options.compiler]   explicit compiler path
 * @param {number}  [options.runs=2]     number of pdflatex passes
 * @param {boolean} [options.quiet=false] suppress compiler stdout to console
 * @param {string}  [options.configFile] path to tw2tex.config.json
 * @returns {{ pdf: string, log: string, exitCode: number, stdout: string, stderr: string }}
 */
function compileTex(texFile, options) {
	options = options || {};
	const compiler = resolveCompiler({ ...options, cwd: path.dirname(texFile) });
	const outDir   = path.dirname(texFile);
	const runs     = options.runs !== undefined ? options.runs : 2;

	let lastResult;
	for(let i = 0; i < runs; i++) {
		const result = spawnSync(
			compiler,
			[
				"-interaction=nonstopmode",
				"-halt-on-error",
				"-output-directory", outDir,
				texFile,
			],
			{ cwd: outDir, encoding: "utf8", stdio: "pipe" }
		);

		lastResult = result;

		if(!options.quiet) {
			if(result.stdout) process.stdout.write(result.stdout);
			if(result.stderr) process.stderr.write(result.stderr);
		}

		if(result.status !== 0) break;
	}

	const baseName = path.basename(texFile, ".tex");
	const pdfPath  = path.join(outDir, baseName + ".pdf");
	const logPath  = path.join(outDir, baseName + ".log");

	return {
		pdf:      fs.existsSync(pdfPath) ? pdfPath : null,
		log:      fs.existsSync(logPath) ? logPath : null,
		exitCode: lastResult ? lastResult.status : -1,
		stdout:   lastResult ? (lastResult.stdout || "") : "",
		stderr:   lastResult ? (lastResult.stderr || "") : "",
	};
}

/**
 * Write a LaTeX string to a temp file, compile it, and return the result.
 *
 * @param {string}  latexString  full .tex document content
 * @param {string}  outDir       directory to write the .tex and .pdf into
 * @param {Object}  [options]    same as compileTex options
 * @returns {{ pdf, log, exitCode, stdout, stderr }}
 */
function compile(latexString, outDir, options) {
	options  = options || {};
	const texPath = path.join(path.resolve(outDir), "tw2tex-output.tex");
	fs.mkdirSync(path.dirname(texPath), { recursive: true });
	fs.writeFileSync(texPath, latexString, "utf8");
	return compileTex(texPath, options);
}

module.exports = { resolveCompiler, compileTex, compile, findConfig };
