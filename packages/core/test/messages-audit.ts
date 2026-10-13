import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Audit of the message dictionaries (`defineMessages`) of one package: every dictionary has the same keys in English and Korean, no key is left
 * unreferenced, and every dictionary file follows the one naming convention (`messages.ts` for the main dictionary of a folder, `<name>.messages.ts`
 * for any other). A key counts as referenced when its text appears as a string literal in the package's source, or when it starts (and ends) like the static
 * parts of a template literal that builds keys (`` `filter.${value}` ``).
 */

interface Bundle {
	readonly namespace: string;
	readonly messages: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

const isBundle = (value: unknown): value is Bundle =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Bundle).namespace === "string" &&
	typeof (value as Bundle).messages === "object";

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === "dist") continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
	}
	return out;
}

const isTest = (file: string) => /(^|\/)(__test__|test)\//.test(file) || /\.test\.tsx?$/.test(file);

export interface MessagesAudit {
	/** Dictionary files that do not follow the naming convention. */
	readonly misnamed: string[];
	/** `file: key` for a key present in one language only. */
	readonly mismatched: string[];
	/** `file: key` for a key no source refers to. */
	readonly unreferenced: string[];
}

/** Audits the dictionaries under `srcDir` (a package's `src`). */
export async function auditMessages(srcDir: string): Promise<MessagesAudit> {
	const files = walk(srcDir).filter((file) => !isTest(file));
	const sources = files.map((file) => ({ file, text: readFileSync(file, "utf8") }));
	const dictionaries = sources.filter((source) => source.text.includes("defineMessages("));

	const literals = new Set<string>();
	const templates: { prefix: string; suffix: string }[] = [];
	for (const { text } of sources) {
		for (const match of text.matchAll(/(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g)) literals.add(match[2] as string);
		for (const match of text.matchAll(/`([^`]*\$\{[^`]*)`/g)) {
			const parts = (match[1] as string).split(/\$\{[^}]*\}/);
			const prefix = parts[0] ?? "";
			const suffix = parts.length > 1 ? (parts.at(-1) ?? "") : "";
			if (prefix.length + suffix.length >= 3) templates.push({ prefix, suffix });
		}
		for (const match of text.matchAll(/`([^`$]*)`/g)) literals.add(match[1] as string);
	}
	const referenced = (key: string) =>
		literals.has(key) || templates.some(({ prefix, suffix }) => key.startsWith(prefix) && key.endsWith(suffix));

	const audit = { misnamed: [] as string[], mismatched: [] as string[], unreferenced: [] as string[] };
	for (const { file } of dictionaries) {
		const name = path.basename(file);
		const relative = path.relative(srcDir, file);
		if (!/^(.+\.)?messages\.ts$/.test(name)) audit.misnamed.push(relative);
		const module = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
		for (const bundle of Object.values(module).filter(isBundle)) {
			const english = Object.keys(bundle.messages.en ?? {});
			const korean = new Set(Object.keys(bundle.messages.ko ?? {}));
			for (const key of english) {
				if (!korean.has(key)) audit.mismatched.push(`${relative}: ${key} (no ko)`);
				if (!referenced(key)) audit.unreferenced.push(`${relative}: ${key}`);
			}
			const englishSet = new Set(english);
			for (const key of korean) if (!englishSet.has(key)) audit.mismatched.push(`${relative}: ${key} (no en)`);
		}
	}
	return audit;
}
