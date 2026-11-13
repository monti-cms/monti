import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LOCKFILES } from "../init/detect";
import { type Ask, Cancelled, terminalAsk } from "../prompt";
import { adminFolder, configFileOf, fileUpward, installedPackage, readJson } from "../site";

/** One thing `monti add` copies (the blocks package's `registry.json`, doc 18). */
type Item = { name: string; blocks?: string[]; marks?: string[]; needs: string[]; summary: string };
type Registry = { items: Item[] };

export type AddOptions = {
	cwd: string;
	argv: string[];
	out?: (line: string) => void;
	err?: (line: string) => void;
	/** Questions for `monti add` with no name: the terminal's when there is one (left out), none (`null`: it only lists what there is). */
	ask?: Ask | null;
	/** The blocks package's folder, when it is not the one the site has installed (this command's own tests). */
	from?: string;
};

/** Where the copied blocks live: beside the change files (`monti/changes`), in the site's own `monti/` folder. */
export const BLOCKS_DIR = path.join("monti", "blocks");

const INDEX = `// The site's blocks and marks (doc 18). \`monti add\` adds to these lists, and the site may add its own.
// monti.config.ts and the site's renderDocument read them; the admin page reads them through admin.ts.
import type { AnyBlockDefinition, MarkDefinition } from "@monti-cms/core";

export const blocks: AnyBlockDefinition[] = [
];

export const marks: MarkDefinition[] = [
];
`;

const ADMIN = `"use client";

// The blocks as the admin page gets them: from a "use client" module, so their components reach the admin in the browser (doc 16).
import type { AdminBlockDefinition, AdminMarkDefinition } from "@monti-cms/admin";
import { blocks, marks } from "./index";

export const adminBlocks = blocks as AdminBlockDefinition[];
export const adminMarks = marks as AdminMarkDefinition[];
`;

/** The folder of an installed package, found the way Node finds it. */
function packageDir(cwd: string, name: string): string | null {
	for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
		const found = path.join(dir, "node_modules", ...name.split("/"));
		if (existsSync(path.join(found, "package.json"))) return found;
		if (path.dirname(dir) === dir) return null;
	}
}

/** The command a person types to install packages with the site's package manager. */
function installLine(cwd: string, names: string[]): string {
	const lockfile = fileUpward(cwd, Object.keys(LOCKFILES));
	const manager = lockfile ? LOCKFILES[lockfile.name as keyof typeof LOCKFILES] : "npm";
	return `${manager} ${manager === "npm" ? "install" : "add"} ${names.join(" ")}`;
}

/** A path from one file to another, as an import names it (`./x`, `../x`), without a TypeScript extension. */
function importPath(from: string, to: string): string {
	const relative = path
		.relative(path.dirname(from), to)
		.split(path.sep)
		.join("/")
		.replace(/\.tsx?$/, "");
	return relative.startsWith(".") ? relative : `./${relative}`;
}

/** A source file with an import after its last one (or after a `"use client"` line, or at its top). */
function withImport(source: string, line: string): string {
	const imports = [
		...source.matchAll(/^import[\s\S]*?from\s+["'][^"']+["'];?[^\S\n]*$|^import\s+["'][^"']+["'];?[^\S\n]*$/gm),
	];
	const last = imports.at(-1);
	if (last?.index !== undefined) {
		const end = last.index + last[0].length;
		return `${source.slice(0, end)}\n${line}${source.slice(end)}`;
	}
	const directive = /^\s*["']use (client|server)["'];?\n/.exec(source);
	if (directive) return `${source.slice(0, directive[0].length)}${line}\n${source.slice(directive[0].length)}`;
	return `${line}\n${source}`;
}

/** Every source file of the site (not its dependencies, its build, or the copied blocks themselves). */
function sourceFiles(dir: string, root: string): string[] {
	const skip = new Set(["node_modules", ".next", "dist", "out", ".git", ".monti"]);
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory())
			return skip.has(entry.name) || full === path.join(root, BLOCKS_DIR) ? [] : sourceFiles(full, root);
		return /\.(tsx?|jsx?|mjs)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [full] : [];
	});
}

/** The lines of a list in `index.ts` (`export const blocks … = [ … ];`) with these names added at its end. */
function withEntries(source: string, list: "blocks" | "marks", names: string[]): string | null {
	const found = new RegExp(`(export const ${list}\\b[^=]*=\\s*\\[)([\\s\\S]*?)(\\n?\\];)`).exec(source);
	if (!found || found.index === undefined) return null;
	const [whole, head, inside, tail] = found as unknown as [string, string, string, string];
	const fresh = names.filter((name) => !new RegExp(`\\b${name}\\b`).test(inside));
	if (fresh.length === 0) return source;
	const kept = inside.replace(/\s*$/, "");
	// A list written on one line or by hand may end without a comma (\`[tooltip, color]\`): one goes after its last name first.
	const joined = kept.trim() === "" || kept.endsWith(",") ? kept : `${kept},`;
	const body = `${joined}${fresh.map((name) => `\n\t${name},`).join("")}`;
	return `${source.slice(0, found.index)}${head}${body}${tail.startsWith("\n") ? tail : `\n${tail}`}${source.slice(found.index + whole.length)}`;
}

type Wiring = { done: string[]; byHand: string[] };

/**
 * The site's own files that need the blocks: the config, the admin page and the calls of `renderDocument` (each block loads its own look). Each
 * is changed only where it lacks the blocks, and only by adding: an import, a value. A file this cannot change surely is left alone, and its line is
 * said for a person to add.
 */
function wire(cwd: string): Wiring {
	const done: string[] = [];
	const byHand: string[] = [];
	const blocksDir = path.join(cwd, BLOCKS_DIR);
	const index = path.join(blocksDir, "index.ts");
	const admin = path.join(blocksDir, "admin.ts");
	const write = (file: string, text: string, what: string) => {
		writeFileSync(file, text);
		done.push(`${path.relative(cwd, file)} (${what})`);
	};

	// monti.config.ts: blocks, marks
	const configName = configFileOf(cwd);
	if (!configName)
		byHand.push(
			`monti.config.ts: import { blocks, marks } from "./${BLOCKS_DIR}" and add blocks, marks to defineConfig`,
		);
	else {
		const file = path.join(cwd, configName);
		const source = readFileSync(file, "utf8");
		if (!source.includes(`/${BLOCKS_DIR.split(path.sep).join("/")}"`)) {
			const at = /defineConfig\(\{[^\S\n]*\n/.exec(source);
			if (
				!at ||
				/^\s*(blocks|marks)\s*[:,]/m.test(source) ||
				/\b(const|let|import)\b[^;\n]*\b(blocks|marks)\b/.test(source)
			)
				byHand.push(
					`${configName}: import { blocks, marks } from "./${BLOCKS_DIR}" and add blocks, marks to defineConfig`,
				);
			else {
				const edited = `${source.slice(0, at.index + at[0].length)}\tblocks,\n\tmarks,\n${source.slice(at.index + at[0].length)}`;
				// The config is loaded by the CLI too (jiti), which does not know the site's `@/` alias: a relative import.
				write(
					file,
					withImport(edited, `import { blocks, marks } from "./${BLOCKS_DIR.split(path.sep).join("/")}";`),
					"blocks, marks",
				);
			}
		}
	}

	// The admin page: <AdminPage blocks={adminBlocks} marks={adminMarks} />
	const page = adminFolder(cwd)?.page;
	if (!page)
		byHand.push(`The admin page: <AdminPage blocks={adminBlocks} marks={adminMarks} />, from ${BLOCKS_DIR}/admin`);
	else if (!readFileSync(page, "utf8").includes("adminBlocks")) {
		const source = readFileSync(page, "utf8");
		if (!/<AdminPage\b/.test(source) || /<AdminPage\b[^>]*\bblocks=/.test(source))
			byHand.push(
				`${path.relative(cwd, page)}: <AdminPage blocks={adminBlocks} marks={adminMarks} />, from ${importPath(page, admin)}`,
			);
		else {
			const edited = source.replace(/<AdminPage\b/, "<AdminPage blocks={adminBlocks} marks={adminMarks}");
			write(
				page,
				withImport(edited, `import { adminBlocks, adminMarks } from "${importPath(page, admin)}";`),
				"blocks, marks",
			);
		}
	}

	// The calls of renderDocument: blocks, marks in their options
	for (const file of sourceFiles(cwd, cwd)) {
		const source = readFileSync(file, "utf8");
		if (!source.includes("renderDocument(") || file === index) continue;
		const call = /renderDocument\(([^()]*(?:\([^()]*\))?[^(),]*),\s*\{/.exec(source);
		const relative = path.relative(cwd, file);
		const options = call
			? source.slice(call.index + call[0].length, source.indexOf("}", call.index + call[0].length))
			: "";
		if (call && /\bblocks\b/.test(options)) continue;
		// A name the file already has would be shadowed: a person decides.
		if (!call || /\b(const|let|var|function|import)\b[^;\n]*\b(blocks|marks)\b/.test(source)) {
			byHand.push(`${relative}: renderDocument(…, { blocks, marks, … }), from ${importPath(file, index)}`);
			continue;
		}
		const at = call.index + call[0].length;
		const edited = `${source.slice(0, at)} blocks, marks,${source.slice(at)}`;
		write(file, withImport(edited, `import { blocks, marks } from "${importPath(file, index)}";`), "blocks, marks");
	}
	return { done, byHand };
}

/**
 * `monti add [name …]` (doc 18): copies blocks of `@monti-cms/blocks` into the site's `monti/blocks/`, where they are the site's own, and the
 * first time wires the site to them. A block whose folder is there already is left as it is (the site may have changed it). With no name it lists
 * what there is, and at a terminal asks which. It installs nothing: it says what a block needs.
 */
export async function add(options: AddOptions): Promise<number> {
	const out = options.out ?? ((line: string) => console.log(line));
	const err = options.err ?? ((line: string) => console.error(line));
	const { cwd } = options;
	const from = options.from ?? packageDir(cwd, "@monti-cms/blocks");
	const registry = from ? (readJson(path.join(from, "registry.json")) as Registry | null) : null;
	if (!from || !registry) {
		err("Blocks come from @monti-cms/blocks: install it from the same release, then run monti add again.");
		return 1;
	}
	const known = new Map(registry.items.map((item) => [item.name, item]));
	let names = options.argv.filter((arg) => !arg.startsWith("-"));
	if (names.length === 0) {
		const width = Math.max(...registry.items.map((item) => item.name.length));
		out("Blocks and marks to add:");
		for (const item of registry.items) out(`  ${item.name.padEnd(width)}  ${item.summary}`);
		const ask =
			options.ask === undefined
				? process.stdin.isTTY
					? terminalAsk(process.stdin, process.stdout)
					: null
				: options.ask;
		if (!ask) {
			out("Add them by name: monti add callout math");
			return 0;
		}
		try {
			const answer = await ask({
				message: "Which? (names with commas, or none)",
				initial: "none",
				check: (text) => {
					const wrong = text.split(/[\s,]+/).filter((name) => name !== "" && name !== "none" && !known.has(name));
					return wrong.length > 0 ? `There is no ${wrong.join(", ")}.` : null;
				},
			});
			names = answer.split(/[\s,]+/).filter((name) => name !== "" && name !== "none");
		} catch (error) {
			if (error instanceof Cancelled) {
				err(error.message);
				return 1;
			}
			throw error;
		}
		if (names.length === 0) return 0;
	}
	const unknown = names.filter((name) => !known.has(name));
	if (unknown.length > 0) {
		err(`There is no ${unknown.join(", ")}. monti add with no name lists what there is.`);
		return 1;
	}

	const target = path.join(cwd, BLOCKS_DIR);
	const source = path.join(from, "blocks");
	mkdirSync(target, { recursive: true });
	const index = path.join(target, "index.ts");
	if (!existsSync(index)) writeFileSync(index, INDEX);
	if (!existsSync(path.join(target, "admin.ts"))) writeFileSync(path.join(target, "admin.ts"), ADMIN);

	const added: Item[] = [];
	for (const name of [...new Set(names)]) {
		const item = known.get(name) as Item;
		const folder = path.join(target, name);
		if (existsSync(folder)) {
			out(
				`${name} is already in ${path.join(BLOCKS_DIR, name)}: it is the site's own now. Remove the folder to add it again.`,
			);
			continue;
		}
		cpSync(path.join(source, name), folder, {
			recursive: true,
			filter: (file) => statSync(file).isDirectory() || !/\.test\.[cm]?[jt]sx?$/.test(file),
		});
		let text = readFileSync(index, "utf8");
		const exported = [...(item.blocks ?? []), ...(item.marks ?? [])];
		text = withImport(text, `import { ${exported.join(", ")} } from "./${name}";`);
		const withBlocks = item.blocks?.length ? withEntries(text, "blocks", item.blocks) : text;
		const withMarks = withBlocks && item.marks?.length ? withEntries(withBlocks, "marks", item.marks) : withBlocks;
		if (withMarks === null) {
			out(
				`${path.join(BLOCKS_DIR, "index.ts")}: add ${exported.join(", ")} to its lists (they are not where monti add puts them).`,
			);
			writeFileSync(index, text);
		} else writeFileSync(index, withMarks);
		added.push(item);
		out(`Added ${name}: ${path.join(BLOCKS_DIR, name)}${path.sep}`);
	}

	const wiring = wire(cwd);
	for (const line of wiring.done) out(`Wired ${line}`);
	for (const line of wiring.byHand) out(`Left for you: ${line}`);
	const missing = [...new Set(added.flatMap((item) => item.needs))].filter((need) => !installedPackage(cwd, need));
	for (const item of added)
		for (const need of item.needs.filter((each) => missing.includes(each)))
			out(`${item.name} needs ${need}: ${installLine(cwd, [need])}`);
	return 0;
}
