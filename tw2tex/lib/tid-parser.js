"use strict";
/**
 * tid-parser.js – parse TiddlyWiki .tid files into tiddler objects.
 *
 * A .tid file has the format:
 *   key: value
 *   key: value
 *   (blank line)
 *   body text…
 *
 * This module parses one or more tiddler files and returns an array of
 * plain objects: { title, type, tags[], text, <other fields> }.
 */

const fs   = require("fs");
const path = require("path");

/**
 * Parse the raw string content of a single .tid file.
 * @param {string} content
 * @returns {Object}
 */
function parseTidString(content) {
	const lines  = content.replace(/\r\n/g, "\n").split("\n");
	const fields = {};
	let   bodyStart = lines.length; // default: no blank line found

	for(let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if(line === "") {
			bodyStart = i + 1;
			break;
		}
		const colon = line.indexOf(":");
		if(colon === -1) continue;
		const key   = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		if(key) fields[key] = value;
	}

	fields.text = lines.slice(bodyStart).join("\n");

	// Normalize tags to an array
	if(typeof fields.tags === "string") {
		fields.tags = fields.tags
			? fields.tags.split(/\s+/).map(t => t.replace(/^\[\[|\]\]$/g, ""))
			: [];
	} else {
		fields.tags = [];
	}

	return fields;
}

/**
 * Read and parse a .tid file from disk.
 * @param {string} filePath  absolute or relative path to the .tid file
 * @returns {Object}
 */
function parseTidFile(filePath) {
	const content = fs.readFileSync(filePath, "utf8");
	const tiddler = parseTidString(content);
	// Use filename (without extension) as fallback title
	if(!tiddler.title) {
		tiddler.title = path.basename(filePath, ".tid");
	}
	return tiddler;
}

/**
 * Parse an array of .tid file paths into tiddler objects.
 * @param {string[]} filePaths
 * @returns {Object[]}
 */
function parseTidFiles(filePaths) {
	return filePaths.map(parseTidFile);
}

module.exports = { parseTidString, parseTidFile, parseTidFiles };
