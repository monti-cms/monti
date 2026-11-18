#!/usr/bin/env node
// The map of the core's symbols, so an agent sees what already exists before it writes a new one.
//
//   node agent-guard/map.mjs    prints the map of `packages/core/src` (the SessionStart hook runs this)
//   buildMap(root)              returns the same text
//
// For every source file (tests and `__test__/` left out), grouped by layer: its exports as one-line signatures, and in
// files other than `types.ts` its top-level functions that are not exported, marked `[internal]`.
// The map fails open: when it cannot be built, the hook prints a note and the session starts anyway.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_SRC, loadTypeScript, sourceFiles, TEST_FILE } from "./fence.mjs";

const LAYERS = ["db", "rich-text", "engine", "resources", "index.ts"];
const MAX_LINE = 200;
const MAX_TYPE = 120;

// Whitespace collapsed, without the space or trailing comma a wrapped signature leaves inside brackets.
const oneLine = (text) =>
	text
		.replace(/\s+/g, " ")
		.replace(/,\s*([)\]>}])/g, "$1")
		.replace(/([([<]) /g, "$1")
		.replace(/ ([)\]>])/g, "$1")
		.trim();
const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const layerOf = (file) => file.split("/")[0];
const layerRank = (layer) => {
	const rank = LAYERS.indexOf(layer);
	return rank === -1 ? LAYERS.length : rank;
};

function hasModifier(ts, node, kind) {
	return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

/** The text of `node` from its first token up to `end`, on one line. */
function textUpTo(sf, node, end) {
	return oneLine(sf.text.slice(node.getStart(sf), end));
}

/** `name, other, method()`: the names of an interface's, class's or enum's members. */
function memberNames(ts, sf, members) {
	return members
		.map((member) => {
			if (member.name === undefined) return member.kind === ts.SyntaxKind.Constructor ? "constructor()" : undefined;
			const name = member.name.getText(sf);
			const callable = ts.isMethodDeclaration(member) || ts.isMethodSignature(member);
			return callable ? `${name}()` : name;
		})
		.filter((name) => name !== undefined)
		.join(", ");
}

/** A function's signature without its body. */
function functionLine(sf, node) {
	return textUpTo(sf, node, node.body ? node.body.getStart(sf) : node.end).replace(/;$/, "");
}

/** `const name: Type`, or for a function value `const name = (a: A): R => …`. */
function variableLine(ts, sf, statement, declaration) {
	const keyword = statement.declarationList.flags & ts.NodeFlags.Const ? "const" : "let";
	const name = declaration.name.getText(sf);
	if (declaration.type) return `${keyword} ${name}: ${oneLine(declaration.type.getText(sf))}`;
	const value = declaration.initializer;
	if (value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) {
		return `${keyword} ${name} = ${textUpTo(sf, value, value.body.getStart(sf))} …`;
	}
	return `${keyword} ${name}`;
}

/** The part of a declaration's line after `export`, or undefined for a statement the map does not show. */
function declarationLine(ts, sf, node) {
	const start = node.getStart(sf);
	const afterModifiers = (text) => text.replace(/^(?:export\s+|default\s+|declare\s+)+/, "");
	if (ts.isFunctionDeclaration(node)) return afterModifiers(functionLine(sf, node));
	if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node)) {
		const open = sf.text.indexOf("{", node.name ? node.name.end : start);
		const head = afterModifiers(oneLine(sf.text.slice(start, open)));
		return `${head} { ${memberNames(ts, sf, node.members)} }`;
	}
	if (ts.isTypeAliasDeclaration(node)) {
		const head = afterModifiers(textUpTo(sf, node, node.type.getStart(sf)));
		return `${head} ${cut(oneLine(node.type.getText(sf)), MAX_TYPE)}`;
	}
	return undefined;
}

/**
 * The names a file exports under their own name with a local `export { name }`; those declarations are shown as exported.
 * A name exported only under an alias (`export { name as other }`) is not: the export line itself shows the alias.
 */
function locallyExported(ts, sf) {
	const names = new Set();
	for (const statement of sf.statements) {
		if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier || !statement.exportClause) continue;
		if (!ts.isNamedExports(statement.exportClause)) continue;
		for (const element of statement.exportClause.elements) {
			if (element.propertyName === undefined || element.propertyName.text === element.name.text)
				names.add(element.name.text);
		}
	}
	return names;
}

/** The map's lines for one file: exports first, then the `[internal]` functions. */
function fileLines(ts, sf, internals) {
	const exported = [];
	const internal = [];
	const local = locallyExported(ts, sf);
	const add = (isExported, line, isFunction) => {
		if (isExported) exported.push(`export ${line}`);
		else if (internals && isFunction) internal.push(`[internal] ${line}`);
	};
	for (const statement of sf.statements) {
		const isExport = hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword);
		if (ts.isExportDeclaration(statement)) {
			if (statement.moduleSpecifier || statement.exportClause?.elements?.some((element) => element.propertyName)) {
				exported.push(oneLine(statement.getText(sf)).replace(/;$/, ""));
			}
		} else if (ts.isExportAssignment(statement)) {
			exported.push(cut(oneLine(statement.getText(sf)).replace(/;$/, ""), MAX_LINE));
		} else if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				const name = ts.isIdentifier(declaration.name) ? declaration.name.text : undefined;
				const value = declaration.initializer;
				const isFunction = value !== undefined && (ts.isArrowFunction(value) || ts.isFunctionExpression(value));
				add(isExport || local.has(name), variableLine(ts, sf, statement, declaration), isFunction);
			}
		} else {
			const line = declarationLine(ts, sf, statement);
			if (line === undefined) continue;
			const isDefault = hasModifier(ts, statement, ts.SyntaxKind.DefaultKeyword);
			const shown = isDefault ? `default ${line}` : line;
			add(isExport || local.has(statement.name?.text), shown, ts.isFunctionDeclaration(statement));
		}
	}
	return [...exported, ...internal].map((line) => `  ${cut(line, MAX_LINE)}`);
}

/** The map of `packages/core/src` under `root`, as text. */
export function buildMap(root) {
	const ts = loadTypeScript(root);
	const files = sourceFiles(root)
		.filter((file) => !TEST_FILE.test(file) && !file.endsWith(".d.ts"))
		.map((file) => path.posix.relative(CORE_SRC, file))
		.sort((a, b) => layerRank(layerOf(a)) - layerRank(layerOf(b)) || (a < b ? -1 : a > b ? 1 : 0));
	const lines = [
		`# Core symbol map (${CORE_SRC})`,
		"Exports of each file, and [internal] top-level functions. Reuse or extend these before writing a new one.",
	];
	if (files.length === 0) return [...lines, "", "No source files yet."].join("\n");
	let layer;
	for (const file of files) {
		if (layerOf(file) !== layer) {
			layer = layerOf(file);
			lines.push("", `## ${layer.endsWith(".ts") ? layer : `${layer}/`}`);
		}
		const text = readFileSync(path.join(root, CORE_SRC, file), "utf8");
		const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
		const body = fileLines(ts, sf, path.posix.basename(file) !== "types.ts");
		lines.push(file, ...(body.length > 0 ? body : ["  (nothing exported)"]));
	}
	return lines.join("\n");
}

const self = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(self);
if (invoked) {
	try {
		process.stdout.write(`${buildMap(path.resolve(path.dirname(self), ".."))}\n`);
	} catch (error) {
		process.stderr.write(`agent-guard: the core symbol map could not be built (${error.message})\n`);
	}
}
