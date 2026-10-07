import type { Site } from "../../site";
import { DATE_KEYS, LOCALE_KEYS, RELATION_KEYS, SUMMARY_KEYS } from "../front-matter-keys";
import {
	type FieldTarget,
	type FolderMapping,
	fieldOfTarget,
	type ImportMapping,
	LOCALE_SOURCES,
	type LocaleSource,
	TARGET_DRAFT,
	TARGET_LOCALE,
	TARGET_PUBLISHED,
	TARGET_PUBLISHED_AT,
	TARGET_SKIP,
	TARGET_SLUG,
} from "./mapping";
import { type Choice, choose, type Prompter } from "./prompt";
import { derivePath, folderKeyOf, legacyFolderKeyOf, localeCode, type ParsedSource } from "./source";

/**
 * Guessing the mapping. A guess is confident when a name matches (a folder called `posts` and a collection called `post`; a key `tags` and a relation field
 * `tagIds`). When it is not, the guess becomes a {@link Question}: asked in a terminal, answered with its non-interactive answer under `--yes` or without a terminal.
 */

export interface Question {
	readonly id: string;
	readonly text: string;
	readonly choices: readonly Choice[];
	/** The choice Enter takes. */
	readonly defaultIndex: number;
	/** The choice taken when nobody can be asked. */
	readonly autoIndex: number;
	readonly apply: (value: string) => void;
}

export interface GuessResult {
	readonly mapping: ImportMapping;
	readonly questions: Question[];
	/** Things that were decided without asking and that the person should know (a new key was skipped). */
	readonly notes: string[];
}

export interface GuessOptions {
	/** The collection every folder goes to (`--collection`). */
	readonly collection?: string;
	/** The saved mapping, when there is one. What it decides is kept; only what it does not cover is guessed. */
	readonly existing?: ImportMapping;
	/** The name of the scanned folder, for the files that lie directly in it. */
	readonly rootName: string;
}

const norm = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** `posts` → `post`, `categories` → `category`. */
const singular = (value: string) =>
	value.endsWith("ies")
		? `${value.slice(0, -3)}y`
		: value.endsWith("s") && !value.endsWith("ss")
			? value.slice(0, -1)
			: value;

const isString = (value: unknown): value is string => typeof value === "string";

/** The values a key has across the files of a folder. */
const valuesOf = (files: readonly ParsedSource[], key: string): unknown[] =>
	files.flatMap((file) => (Object.hasOwn(file.front, key) ? [file.front[key]] : []));

const allBooleans = (values: readonly unknown[]) =>
	values.length > 0 && values.every((value) => typeof value === "boolean");

/** The languages of the files a front matter key names, when every value of the key is a language of the site. */
const isLocaleKey = (site: Site, values: readonly unknown[]) =>
	values.length > 0 && values.every((value) => isString(value) && localeCode(value, site.LOCALES) !== undefined);

interface FieldInfo {
	readonly name: string;
	readonly kind: string;
	readonly role?: string;
	readonly to?: string;
}

const fieldsOf = (site: Site, collection: string): FieldInfo[] =>
	site.storedFields(collection).map(({ name, field }) => ({
		name,
		kind: field.kind,
		...(field.role ? { role: field.role } : {}),
		...(field.kind === "relation" ? { to: field.to } : {}),
	}));

/** The collections a folder name may mean, best first. Document collections come before item collections. */
function collectionMatches(site: Site, folderName: string): string[] {
	const wanted = singular(norm(folderName));
	if (!wanted) return [];
	return site.COLLECTIONS.filter((name) => {
		const label = site.schemaOf(name).label;
		return singular(norm(name)) === wanted || (typeof label === "string" && singular(norm(label)) === wanted);
	}).sort((a, b) => Number(site.isItemCollection(a)) - Number(site.isItemCollection(b)));
}

/** The relation fields a key (`tags`, `category`) most likely means. */
function relationMatches(site: Site, collection: string, key: string): FieldInfo[] {
	const wanted = RELATION_KEYS[key.toLowerCase()] ?? singular(norm(key));
	return fieldsOf(site, collection).filter((field) => {
		if (field.kind !== "relation") return false;
		const name = singular(norm(field.name).replace(/ids?$/, ""));
		return name === wanted || singular(norm(field.to ?? "")) === wanted;
	});
}

const createDefault = (site: Site, field: FieldInfo) => (field.to ? site.isItemCollection(field.to) : false);

interface FolderState {
	readonly key: string;
	readonly files: readonly ParsedSource[];
}

/**
 * First half of the guess: where each folder goes (and where the language comes from). What the saved mapping does not decide is guessed; the questions the
 * guess leaves are returned. Call {@link guessFieldMappings} after they are answered: the fields depend on the collection.
 */
export function guessCollections(site: Site, sources: readonly ParsedSource[], options: GuessOptions): GuessResult {
	const mapping: ImportMapping = options.existing ? structuredClone(options.existing) : { version: 1, folders: {} };
	const questions: Question[] = [];
	const notes: string[] = [];

	if (options.collection && !site.isCollection(options.collection)) {
		throw new Error(
			`--collection ${options.collection}: the site has no such collection (collections: ${site.COLLECTIONS.join(", ")})`,
		);
	}

	const folders = new Map<string, ParsedSource[]>();
	/** Folders whose files lie directly in the scanned folder: the person pointed at this folder of posts itself. */
	const directFolders = new Set<string>();
	for (const source of sources) {
		const folder = folderKeyOf(source, site.LOCALES);
		folders.set(folder, [...(folders.get(folder) ?? []), source]);
		if (derivePath(source.rel, site.LOCALES).folder === ".") directFolders.add(folder);
		// A mapping saved before the keys were paths from the working directory names the folder relative to the scanned one: it keeps its decisions under the new key.
		const legacy = legacyFolderKeyOf(source.rel, site.LOCALES);
		const old = mapping.folders[legacy];
		if (legacy !== folder && mapping.folders[folder] === undefined && old !== undefined) {
			mapping.folders[folder] = old;
			delete mapping.folders[legacy];
		}
	}

	// Where the language of a file comes from: every source that shows up in the files.
	if (!mapping.locale) {
		const from = new Set<LocaleSource>();
		for (const source of sources) {
			const info = derivePath(source.rel, site.LOCALES);
			if (info.localeFromFilename) from.add("filename");
			if (info.localeFromFolder) from.add("folder");
			for (const key of Object.keys(source.front)) {
				const value = source.front[key];
				if (LOCALE_KEYS.has(key.toLowerCase()) && isString(value) && localeCode(value, site.LOCALES)) {
					from.add("frontMatter");
				}
			}
		}
		mapping.locale = { from: LOCALE_SOURCES.filter((source) => from.has(source)) };
	}

	for (const [key, files] of [...folders].sort(([a], [b]) => (a < b ? -1 : 1))) {
		const state: FolderState = { key, files };
		const existing = mapping.folders[key];
		const folder: FolderMapping = existing ?? { collection: null, fields: {} };
		mapping.folders[key] = folder;

		if (options.collection) {
			folder.collection = options.collection;
		} else if (existing) {
			if (existing.collection !== null && !site.isCollection(existing.collection)) {
				throw new Error(
					`the mapping sends the folder "${key}" to the collection "${existing.collection}", which the site does not have (collections: ${site.COLLECTIONS.join(", ")})`,
				);
			}
		} else {
			guessCollection(site, state, folder, options.rootName, questions, directFolders.has(key));
		}
	}
	return { mapping, questions, notes };
}

/** Second half: which field each front matter key of each imported folder goes to. */
export function guessFieldMappings(site: Site, sources: readonly ParsedSource[], mapping: ImportMapping): GuessResult {
	const questions: Question[] = [];
	const notes: string[] = [];
	const folders = new Map<string, ParsedSource[]>();
	for (const source of sources) {
		const folder = folderKeyOf(source, site.LOCALES);
		folders.set(folder, [...(folders.get(folder) ?? []), source]);
	}
	for (const [key, files] of [...folders].sort(([a], [b]) => (a < b ? -1 : 1))) {
		const folder = mapping.folders[key];
		if (folder && folder.collection !== null) guessFields(site, { key, files }, folder, questions, notes);
	}
	return { mapping, questions, notes };
}

function guessCollection(
	site: Site,
	state: FolderState,
	folder: FolderMapping,
	rootName: string,
	questions: Question[],
	direct: boolean,
): void {
	const name = state.key === "." ? rootName : state.key.split("/").pop() || state.key;
	const matches = collectionMatches(site, name);
	if (matches.length === 1) {
		folder.collection = matches[0] as string;
		return;
	}
	const documents = site.COLLECTIONS.filter((candidate) => !site.isItemCollection(candidate));
	const ordered =
		matches.length > 1 ? matches : [...documents, ...site.COLLECTIONS.filter((c) => !documents.includes(c))];
	const choices: Choice[] = [
		...ordered.map((candidate) => ({ label: `${candidate}  (${site.schemaOf(candidate).label})`, value: candidate })),
		{ label: "Do not import this folder", value: "" },
	];
	// With one document collection that is the likely home; with several nothing is chosen without asking.
	const lone = matches.length === 0 && documents.length === 1 ? 0 : matches.length > 1 ? 0 : -1;
	folder.collection = null;
	questions.push({
		id: `collection:${state.key}`,
		text: `Which collection do the ${state.files.length} file${state.files.length === 1 ? "" : "s"} in "${state.key === "." ? rootName : state.key}" go to?`,
		choices,
		defaultIndex: lone >= 0 ? lone : choices.length - 1,
		// Nobody is asked: an unclear folder is left out rather than put in the wrong collection. The exception is the folder that was pointed at itself
		// (`monti import content/blog`, the next step `monti init` prints) on a site with a single document collection: posts can only go there, so it is not
		// left out for being called something else than `post`.
		autoIndex: lone === 0 && matches.length === 0 && direct ? 0 : choices.length - 1,
		apply: (value) => {
			folder.collection = value === "" ? null : value;
		},
	});
}

function guessFields(
	site: Site,
	state: FolderState,
	folder: FolderMapping,
	questions: Question[],
	_notes: string[],
): void {
	const collection = folder.collection as string;
	const info = fieldsOf(site, collection);
	const titleName = site.titleField(collection).name;
	const summaryName = info.find((field) => field.role === "summary")?.name;
	const used = new Set(
		Object.values(folder.fields).flatMap((value) => {
			const named = fieldOfTarget(value);
			return named ? [named.field] : [];
		}),
	);
	const reservedUsed = new Set(
		Object.values(folder.fields).flatMap((value) => {
			const text = typeof value === "string" ? value : value.field;
			return text.startsWith("@") && text !== TARGET_SKIP ? [text] : [];
		}),
	);

	const keys: string[] = [];
	for (const file of state.files) {
		for (const key of Object.keys(file.front)) if (!keys.includes(key)) keys.push(key);
	}

	const claimField = (_key: string, name: string | undefined): FieldTarget | undefined => {
		if (!name || used.has(name)) return undefined;
		used.add(name);
		const field = info.find((candidate) => candidate.name === name);
		if (field?.kind === "relation") return { field: name, create: createDefault(site, field) };
		return name;
	};
	const claimReserved = (target: string): string | undefined => {
		if (reservedUsed.has(target)) return undefined;
		reservedUsed.add(target);
		return target;
	};

	for (const key of keys) {
		if (Object.hasOwn(folder.fields, key)) continue;
		const lower = key.toLowerCase();
		const values = valuesOf(state.files, key);
		let decided: FieldTarget | undefined;

		if (lower === "title") decided = claimField(key, titleName);
		else if (lower === "slug") decided = claimReserved(TARGET_SLUG);
		else if (DATE_KEYS.has(lower)) decided = claimReserved(TARGET_PUBLISHED_AT);
		else if (lower === "draft" && allBooleans(values)) decided = claimReserved(TARGET_DRAFT);
		else if (lower === "published") {
			decided = allBooleans(values) ? claimReserved(TARGET_PUBLISHED) : claimReserved(TARGET_PUBLISHED_AT);
		} else if (LOCALE_KEYS.has(lower) && isLocaleKey(site, values)) decided = claimReserved(TARGET_LOCALE);
		else if (SUMMARY_KEYS.has(lower))
			decided = claimField(key, summaryName ?? info.find((f) => norm(f.name) === norm(key))?.name);
		else if (Object.hasOwn(RELATION_KEYS, lower)) {
			const matches = relationMatches(site, collection, key).filter((field) => !used.has(field.name));
			const relations = info.filter((field) => field.kind === "relation" && !used.has(field.name));
			const sameName = info.find((field) => field.kind !== "relation" && norm(field.name) === norm(key));
			if (matches.length === 1) decided = claimField(key, matches[0]?.name);
			// A plain field of the same name (a `series` text field) is where the key goes: no relation was meant.
			else if (matches.length === 0 && sameName) decided = claimField(key, sameName.name);
			else if (relations.length > 0) {
				// Not clear which relation field the key means: ask.
				const choices: Choice[] = [
					...(matches.length > 1 ? matches : relations).map((field) => ({
						label: `${field.name}  (${field.to})`,
						value: field.name,
					})),
					{ label: "Do not import this key", value: TARGET_SKIP },
				];
				const slot: { target: FieldTarget } = { target: TARGET_SKIP };
				folder.fields[key] = TARGET_SKIP;
				questions.push({
					id: `field:${state.key}:${key}`,
					text: `Which field does the front matter key "${key}" go to?`,
					choices,
					defaultIndex: matches.length > 1 ? 0 : choices.length - 1,
					autoIndex: matches.length > 1 ? 0 : choices.length - 1,
					apply: (value) => {
						const field = info.find((candidate) => candidate.name === value);
						if (field && !used.has(field.name)) {
							used.add(field.name);
							slot.target = { field: field.name, create: createDefault(site, field) };
						} else slot.target = TARGET_SKIP;
						folder.fields[key] = slot.target;
						const chosen =
							typeof slot.target === "string"
								? undefined
								: info.find((f) => f.name === fieldOfTarget(slot.target)?.field);
						if (chosen?.to) questions.push(createQuestion(site, state.key, folder, key, chosen));
					},
				});
				continue;
			}
		} else {
			const match = info.find((field) => norm(field.name) === norm(key));
			decided = claimField(key, match?.name);
		}

		if (decided === undefined) {
			folder.fields[key] = TARGET_SKIP;
			continue;
		}
		folder.fields[key] = decided;
		const named = fieldOfTarget(decided);
		const relation = named ? info.find((field) => field.name === named.field && field.kind === "relation") : undefined;
		if (relation?.to && typeof decided !== "string")
			questions.push(createQuestion(site, state.key, folder, key, relation));
	}
}

/** The question whether the entries a relation points to are created when they do not exist yet. */
function createQuestion(site: Site, folderKey: string, folder: FolderMapping, key: string, field: FieldInfo): Question {
	const fallback = createDefault(site, field);
	return {
		id: `create:${folderKey}:${key}`,
		text: `Create ${field.to} entries for "${key}" values that do not exist yet?`,
		choices: [
			{ label: `Yes, create them`, value: "yes" },
			{ label: `No, leave those values out and report them`, value: "no" },
		],
		defaultIndex: fallback ? 0 : 1,
		autoIndex: fallback ? 0 : 1,
		apply: (value) => {
			folder.fields[key] = { field: field.name, create: value === "yes" };
		},
	};
}

/**
 * Puts the questions to the person, or answers them without asking. Returns a line for each question that was answered by leaving something out, so the
 * report can say what was skipped and how to decide it.
 */
export async function resolveQuestions(questions: Question[], prompter: Prompter | undefined): Promise<string[]> {
	const skipped: string[] = [];
	// Answering a question can add the next one (a relation field asks whether to create its targets), so the list is walked as it grows.
	for (let index = 0; index < questions.length; index++) {
		const question = questions[index] as Question;
		const value = prompter
			? await choose(prompter, question.text, question.choices, question.defaultIndex)
			: (question.choices[question.autoIndex] as Choice).value;
		question.apply(value);
		if (!prompter && (value === "" || value === TARGET_SKIP) && question.id.startsWith("collection:")) {
			skipped.push(
				`Not sure where to put ${question.text.replace(/^Which collection do the /, "").replace(/ go to\?$/, "")}, so they are skipped. Pass --collection <name> or run in a terminal to choose.`,
			);
		}
	}
	return skipped;
}
