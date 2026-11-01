/**
 * Loads one entry point of the admin the way a host loads it, and prints what was loaded as JSON on stdout (the test in `../entry-loading.test.ts`
 * reads it). The admin's sources go through Vite (TypeScript, JSX), the packages through Node.
 *
 *   node load-entry.mjs <entry>                                  # a plain load: every module is evaluated
 *   node --conditions=react-server load-entry.mjs <entry> --rsc  # as a server component loads it
 *
 * With `--rsc` the load follows the rules of React Server Components as a bundler applies them: every package resolves with the `react-server`
 * condition, a `"use client"` module (of the admin or of a package) is not evaluated but replaced by client references, and a React export the
 * server build lacks (`useState`, `createContext`) reads as `undefined`, so the load fails only where a server module calls one while loading.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, createServerModuleRunner, parseAst } from "vite";

const [entry, flag] = process.argv.slice(2);
const rsc = flag === "--rsc";
const root = path.resolve(import.meta.dirname, "../../../../..");
const cwd = process.cwd();

const CLIENT_MODULE = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/;

/** The export names of an ES module and the modules it re-exports whole. */
function exportsOf(code) {
	const names = [];
	const stars = [];
	for (const node of parseAst(code).body) {
		if (node.type === "ExportNamedDeclaration") {
			const declaration = node.declaration;
			if (declaration?.id) names.push(declaration.id.name);
			for (const variable of declaration?.declarations ?? []) names.push(variable.id.name);
			for (const specifier of node.specifiers ?? []) names.push(specifier.exported.name ?? specifier.exported.value);
		} else if (node.type === "ExportDefaultDeclaration") names.push("default");
		else if (node.type === "ExportAllDeclaration") stars.push(node.source.value);
	}
	return { names, stars };
}

/** What a server component sees of a client module: a reference per export, which throws if the server calls it. */
function clientReferences(code, id) {
	const { names, stars } = exportsOf(code);
	const reference = (name) =>
		`Object.assign(() => { throw new Error(${JSON.stringify(`${name} of the client module ${id} was called on the server`)}); }, { $$typeof: Symbol.for("react.client.reference") })`;
	return (
		[
			...names.map((name) =>
				name === "default" ? `export default ${reference(name)};` : `export const ${name} = ${reference(name)};`,
			),
			...stars.map((source) => `export * from ${JSON.stringify(source)};`),
		].join("\n") || "export {};"
	);
}

/** The import sources of a module's code (types are gone by now, so these are what it loads). */
function importsOf(code) {
	const sources = new Set();
	const visit = (node) => {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) return node.forEach(visit);
		if (
			(node.type === "ImportDeclaration" ||
				node.type === "ExportNamedDeclaration" ||
				node.type === "ExportAllDeclaration" ||
				node.type === "ImportExpression") &&
			typeof node.source?.value === "string"
		)
			sources.add(node.source.value);
		for (const value of Object.values(node)) if (value && typeof value === "object") visit(value);
	};
	visit(parseAst(code));
	return [...sources];
}

const loaded = new Map();
let clientModules = 0;

const record = {
	name: "record-loaded-modules",
	enforce: "post",
	transform(code, id) {
		const file = path.relative(root, id.replace(/\?.*$/, ""));
		if (rsc && CLIENT_MODULE.test(code)) {
			clientModules += 1;
			loaded.set(file, { client: true, imports: [] });
			return { code: clientReferences(code, file), map: null };
		}
		loaded.set(file, { client: false, imports: importsOf(code) });
		return null;
	},
};

const alias = [];
if (rsc) {
	// React's server build, with every name of the client build: one it lacks is `undefined`, as a bundler links it, instead of a link error.
	const require = createRequire(path.join(cwd, "package.json"));
	const server = require.resolve("react");
	const names = new Set([
		...Object.keys(require(path.join(path.dirname(server), "index.js"))),
		...Object.keys(require(server)),
	]);
	names.delete("default");
	const file = path.join(mkdtempSync(path.join(tmpdir(), "monti-rsc-")), "react.mjs");
	writeFileSync(
		file,
		[
			'import { createRequire } from "node:module";',
			`const React = createRequire(${JSON.stringify(path.join(cwd, "package.json"))})(${JSON.stringify(server)});`,
			"export default React;",
			...[...names].map((name) => `export const ${name} = React.${name};`),
		].join("\n"),
	);
	alias.push({ find: /^react$/, replacement: file });
	// The packages' own client modules (Base UI, React Query, ...) become client references too.
	registerHooks({
		load(url, context, nextLoad) {
			const result = nextLoad(url, context);
			if (result.format !== "module" || result.source == null || !CLIENT_MODULE.test(String(result.source)))
				return result;
			clientModules += 1;
			return { ...result, source: clientReferences(String(result.source), url) };
		},
	});
}

const server = await createServer({
	configFile: false,
	root: cwd,
	logLevel: "error",
	appType: "custom",
	server: { middlewareMode: true, hmr: false, ws: false },
	plugins: [record],
	resolve: { alias },
	ssr: rsc ? { resolve: { conditions: ["react-server"], externalConditions: ["react-server"] } } : {},
});
const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
let failure;
let exports = [];
let reactServer = false;
try {
	exports = Object.keys(await runner.import(path.resolve(cwd, entry)));
	if (rsc) reactServer = typeof (await runner.import("react")).createContext !== "function";
} catch (error) {
	failure = error instanceof Error ? (error.stack ?? error.message) : String(error);
}
await runner.close();
await server.close();
process.stdout.write(
	JSON.stringify({ failure, exports, reactServer, clientModules, loaded: Object.fromEntries(loaded) }),
);
