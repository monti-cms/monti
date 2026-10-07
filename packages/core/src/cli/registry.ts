import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Reading a component registry in the shadcn registry schema: `registry.json` (the index) and one `<name>.json` (a registry item, with the contents
 * of its files) in the same folder. The registry is a folder on disk or a URL that serves those files, so it can be hosted as static files.
 */

/**
 * Where the registry is published, for a CLI that has neither a registry inside its package nor a checkout of the repo (not the case for an installed
 * `@monti-cms/core`, which carries the registry of its own version). A branch moves, so this is the last resort and `--registry <url>` is the way to pin one.
 */
export const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/monti-cms/monti/overhaul/registry/r";

const FileSchema = z.object({
	path: z.string().min(1),
	type: z.string().optional(),
	target: z.string().optional(),
	content: z.string().optional(),
});

const ItemSchema = z.object({
	name: z.string().min(1),
	type: z.string().optional(),
	title: z.string().optional(),
	description: z.string().optional(),
	/** npm packages the files import (`name` or `name@range`). */
	dependencies: z.array(z.string()).optional(),
	devDependencies: z.array(z.string()).optional(),
	/** Other items: a name in the same registry, or the URL of an item. */
	registryDependencies: z.array(z.string()).optional(),
	files: z.array(FileSchema),
});

const IndexSchema = z.object({ name: z.string().optional(), items: z.array(z.object({ name: z.string() })) });

export type RegistryFile = z.infer<typeof FileSchema>;
export type RegistryItem = z.infer<typeof ItemSchema>;

/** A folder on disk or a URL, both holding `registry.json` and `<name>.json`. */
export type RegistrySource =
	| { readonly kind: "dir"; readonly dir: string }
	| { readonly kind: "url"; readonly base: string };

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const isUrl = (value: string) => /^https?:\/\//i.test(value);

/**
 * The registry to read when `--registry` is not given. In order:
 * 1. the one built from this repo, when the CLI runs from a checkout of it (so the sources win while developing);
 * 2. the one shipped inside `@monti-cms/core` (`registry/` next to `dist/`), which is the registry of the installed version, so `monti add` copies the components
 *    that match the packages the app has;
 * 3. the published one, as a last resort.
 */
export function defaultRegistrySource(
	places: { readonly checkout?: string; readonly bundled?: string } = {},
): RegistrySource {
	const checkout = places.checkout ?? fileURLToPath(new URL("../../../../registry/r", import.meta.url));
	if (existsSync(path.join(checkout, "registry.json"))) return { kind: "dir", dir: checkout };
	const bundled = places.bundled ?? fileURLToPath(new URL("../../registry", import.meta.url));
	if (existsSync(path.join(bundled, "registry.json"))) return { kind: "dir", dir: bundled };
	return { kind: "url", base: DEFAULT_REGISTRY_URL };
}

/** `--registry <url|path>`: a URL of the folder (or of its `registry.json`), or a path to the folder (or to its `registry.json`). */
export function parseRegistrySource(spec: string, cwd: string): RegistrySource {
	if (isUrl(spec)) return { kind: "url", base: spec.replace(/\/registry\.json$/, "").replace(/\/+$/, "") };
	const resolved = path.resolve(cwd, spec);
	return { kind: "dir", dir: resolved.endsWith(".json") ? path.dirname(resolved) : resolved };
}

export const describeSource = (source: RegistrySource) => (source.kind === "dir" ? source.dir : source.base);

async function readText(location: string, fetchFn: FetchLike): Promise<string> {
	if (isUrl(location)) {
		const response = await fetchFn(location);
		if (!response.ok) throw new Error(`${location}: HTTP ${response.status}`);
		return response.text();
	}
	return readFileSync(location, "utf8");
}

async function readJson<T>(location: string, schema: z.ZodType<T>, fetchFn: FetchLike): Promise<T> {
	let text: string;
	try {
		text = await readText(location, fetchFn);
	} catch (error) {
		throw new Error(`Cannot read ${location}: ${error instanceof Error ? error.message : String(error)}`);
	}
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(`${location} is not valid JSON.`);
	}
	const parsed = schema.safeParse(json);
	if (!parsed.success)
		throw new Error(`${location} is not a registry file: ${parsed.error.issues[0]?.message ?? "invalid"}`);
	return parsed.data;
}

const locationOf = (source: RegistrySource, file: string) =>
	source.kind === "dir" ? path.join(source.dir, file) : `${source.base}/${file}`;

/** The names the registry lists, `[]` when its index cannot be read. */
async function listNames(source: RegistrySource, fetchFn: FetchLike): Promise<string[]> {
	try {
		const index = await readJson(locationOf(source, "registry.json"), IndexSchema, fetchFn);
		return index.items.map((item) => item.name);
	} catch {
		return [];
	}
}

/** Reads one item: by name from the registry, or from its own URL. */
export async function readItem(source: RegistrySource, ref: string, fetchFn: FetchLike): Promise<RegistryItem> {
	if (isUrl(ref)) return readJson(ref, ItemSchema, fetchFn);
	if (!/^[a-z0-9][a-z0-9-]*$/.test(ref)) throw new Error(`"${ref}" is not a component name.`);
	const location = locationOf(source, `${ref}.json`);
	if (!isUrl(location) && !existsSync(location)) {
		const names = await listNames(source, fetchFn);
		throw new Error(
			`No component "${ref}" in ${describeSource(source)}.${names.length > 0 ? ` Available: ${names.join(", ")}.` : ""}`,
		);
	}
	return readJson(location, ItemSchema, fetchFn);
}

/**
 * The items to install for `names`, each after the items it needs (`registryDependencies`), once each. Cycles are an error.
 */
export async function resolveItems(
	source: RegistrySource,
	names: readonly string[],
	fetchFn: FetchLike,
): Promise<RegistryItem[]> {
	const done = new Map<string, RegistryItem>();
	const visiting: string[] = [];
	const visit = async (ref: string): Promise<void> => {
		const item = await readItem(source, ref, fetchFn);
		if (done.has(item.name)) return;
		if (visiting.includes(item.name))
			throw new Error(`Components need each other: ${[...visiting, item.name].join(" -> ")}.`);
		visiting.push(item.name);
		for (const dependency of item.registryDependencies ?? []) await visit(dependency);
		visiting.pop();
		done.set(item.name, item);
	};
	for (const name of names) await visit(name);
	return [...done.values()];
}
