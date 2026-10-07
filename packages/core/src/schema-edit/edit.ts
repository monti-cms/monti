import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateSchemaTypes } from "../cli/schema-types";
import type { Cms } from "../cms";
import type { SchemaChangeStore } from "../core/store/ports";
import type { SchemaState } from "../core/store/schema-change";
import { type BodyVocabulary, bodyVocabulary } from "../schema/allowed";
import {
	applySchemaChange,
	type ChangeImpact,
	checkSchemaChange,
	checkTransforms,
	diffSchema,
	type ImpactSample,
	type RenameHint,
	type SchemaChange,
	SchemaChangeError,
	type SchemaLike,
	type SuggestedTransform,
	snapshotSchema,
	suggestTransforms,
	type TransformProblem,
} from "../schema-change";
import { parseSchemaFile, SchemaFileError, type SchemaIssue } from "../schema-file/format";
import { formatSchemaText } from "../schema-file/text";
import type { SchemaFile, SchemaMigration } from "../schema-file/types";
import { type SchemaEditAccess, schemaEditAccess } from "./access";

/**
 * What the settings screen does with the schema file: it reads it (`readSchemaScreen`), checks an edit against the stored content (`previewSchemaEdit`: the
 * diff, the entries each change touches, and the data transforms the writer can pick), and saves it (`saveSchemaEdit`: the file, its migrations and version,
 * the generated types, the dev database and the running instance). The two that need a writable file are guarded by `schemaEditAccess`; the routes answer 403 when it
 * says no. All of it is data in, data out; the admin routes and the tests call these.
 */

const MISSING_TABLE = "42P01";
const isMissingTable = (error: unknown) => (error as { code?: string } | null)?.code === MISSING_TABLE;
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

/** The schema file as the screen shows it. */
export interface SchemaScreenState {
	readonly access: { readonly writable: boolean; readonly reason?: string };
	/** The path of the schema file relative to the working directory (what the screen calls the file), or `null` when there is none. */
	readonly file: string | null;
	/** Hash of the file's text: a save names the hash it was edited from, and is refused when the file changed since. `null` without a file. */
	readonly hash: string | null;
	/** The file's content, or (without a file) the schema the instance runs. */
	readonly schema: unknown;
	readonly source: "file" | "site";
	/** The file is on disk but does not check: what is wrong with it, with JSON paths. The screen shows these instead of editing. */
	readonly issues: readonly SchemaIssue[];
	/** The version the instance runs. */
	readonly schemaVersion: number;
	/** The schema last applied to the dev database, or `null` when none was (or the store has no schema record yet). */
	readonly applied: { readonly schemaVersion: number; readonly appliedAt: string } | null;
	/** Collections the config adds in code: not in the file, so the screen cannot edit them. */
	readonly codeCollections: readonly string[];
	/** The block and mark names a body list can name. */
	readonly vocabulary: BodyVocabulary;
	/** The admin path, for links to entries. */
	readonly collections: readonly string[];
}

const relativeToCwd = (file: string) => path.relative(process.cwd(), file).split(path.sep).join("/");

async function appliedState(cms: Cms): Promise<SchemaState | null> {
	try {
		return await cms.store().readSchemaState();
	} catch {
		return null;
	}
}

/** What `GET /v1/schema` answers: the file, its hash, and the facts the screen needs (see {@link SchemaScreenState}). */
export async function readSchemaScreen(cms: Cms): Promise<SchemaScreenState> {
	const access = schemaEditAccess(cms);
	const file = access.file ?? cms.schemaFile();
	let text: string | undefined;
	if (file) {
		try {
			text = readFileSync(file, "utf8");
		} catch {
			text = undefined;
		}
	}
	let schema: unknown;
	let issues: SchemaIssue[] = [];
	if (text !== undefined) {
		try {
			schema = JSON.parse(text);
			parseSchemaFile(schema, relativeToCwd(file as string));
		} catch (error) {
			issues =
				error instanceof SchemaFileError
					? [...error.issues]
					: [{ path: "", message: error instanceof Error ? error.message : String(error) }];
		}
	}
	const { config } = cms.site;
	if (schema === undefined && issues.length === 0) {
		schema = {
			schemaVersion: config.schemaVersion ?? 1,
			collections: config.collections,
			locales: config.locales,
			defaultLocale: config.defaultLocale,
			...(config.timeZone !== undefined ? { timeZone: config.timeZone } : {}),
		};
	}
	const applied = await appliedState(cms);
	const inFile = isRecord(schema) && isRecord(schema.collections) ? Object.keys(schema.collections) : [];
	return {
		access: access.writable ? { writable: true } : { writable: false, reason: access.reason },
		file: file ? relativeToCwd(file) : null,
		hash: text === undefined ? null : hashOf(text),
		schema: schema ?? null,
		source: text === undefined ? "site" : "file",
		issues,
		schemaVersion: config.schemaVersion ?? 1,
		applied: applied ? { schemaVersion: applied.schemaVersion, appliedAt: applied.appliedAt.toISOString() } : null,
		codeCollections: text === undefined ? [] : Object.keys(config.collections).filter((name) => !inFile.includes(name)),
		vocabulary: bodyVocabulary(cms.site),
		collections: Object.keys(config.collections),
	};
}

/** What the writer says about a change the diff cannot tell: that a field or an option was renamed (the screen knows, it did the rename). */
export type RenameInput =
	| { readonly kind: "field"; readonly collection: string; readonly from: string; readonly to: string }
	| {
			readonly kind: "option";
			readonly collection: string;
			readonly field: string;
			readonly from: string;
			readonly to: string;
	  };

/** What the screen sends to check or save an edit. */
export interface SchemaEditInput {
	/** The schema file's content as edited. `migrations` and `schemaVersion` are the file's own; the save appends the chosen transforms and raises the version. */
	readonly schema: unknown;
	/**
	 * The transforms the writer picked (without ids; the server names them). Left out: the defaults of {@link decisionsOf} (a rename when the screen did one,
	 * else a mapping or a drop only where no stored entry holds the value).
	 */
	readonly transforms?: readonly SuggestedTransform[];
	/** Renames the screen made, so a rename is offered as a rename and not as a removal. */
	readonly renames?: readonly RenameInput[];
}

/** A change that has more than one thing the data can do about it: the writer picks. */
export interface SchemaDecision {
	readonly key: string;
	readonly change: SchemaChange;
	/** Entries the change touches if no transform handles it, and a few of them. */
	readonly entries: number;
	readonly sample: readonly ImpactSample[];
	/** What the writer can pick, the first being the one the server would pick. An empty pick (no transform) is always possible and not listed. */
	readonly suggestions: readonly SuggestedTransform[];
	/** The pick in effect: the one the screen sent, or the default. `null`: no transform. */
	readonly chosen: SuggestedTransform | null;
}

export interface SchemaEditPreview {
	/** The edit checks. When it does not, `issues` says what is wrong, with JSON paths, and the rest is empty. */
	readonly valid: boolean;
	readonly issues: readonly SchemaIssue[];
	/** Something would be written or applied: the content differs from the file, or a change or transform is pending. */
	readonly changed: boolean;
	/** The schema changes the stored data cares about (collections, fields, options, locales, allowed blocks), each with the entries it touches. */
	readonly impacts: readonly ChangeImpact[];
	readonly decisions: readonly SchemaDecision[];
	/** The transforms in effect, in the order they would be appended to `migrations` (with the ids the save would give them). */
	readonly transforms: readonly SchemaMigration[];
	/** Problems that stop the save (a transform that does not fit the schema). */
	readonly problems: readonly TransformProblem[];
	/** The version the save would record. */
	readonly nextVersion: number;
	readonly currentVersion: number;
	/** The schema applied to the dev database is older than the file (the file was changed by hand and not applied): the diff includes that. */
	readonly baseline: "applied" | "file";
	readonly bodiesRead: number;
}

/** A message of `defineSite` as an issue: it starts with `cms.config:` and names a collection, which gives the JSON path. */
function issueFromError(error: unknown, collections: readonly string[]): SchemaIssue {
	const message = error instanceof Error ? error.message : String(error);
	const text = message.replace(/^cms\.config:\s*/, "");
	const named = /^collection "([^"]+)"/.exec(text);
	if (named?.[1]) return { path: `collections.${named[1]}`, message: text };
	const dotted = /^([\w-]+)\.([\w.[\]-]+)/.exec(text);
	if (dotted?.[1] && collections.includes(dotted[1])) {
		return { path: `collections.${dotted[1]}.${dotted[2]}`.replace(/\.body$/, ".body"), message: text };
	}
	return { path: "", message: text };
}

const OPS: Record<SchemaMigration["op"], string> = {
	renameField: "rename",
	mapOption: "map",
	dropField: "drop",
	setDefault: "default",
};

/** The id a new transform gets: `v<version>-<op>-<collection>-<field>`, with a number added when it is taken. */
function idFor(transform: SuggestedTransform, version: number, taken: Set<string>): string {
	const subject =
		transform.op === "renameField" ? transform.from : transform.op === "mapOption" ? transform.field : transform.field;
	const base = `v${version}-${OPS[transform.op]}-${transform.collection}-${subject}`;
	let id = base;
	for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
	taken.add(id);
	return id;
}

/** The first suggestion that is safe to pick without asking: never a drop that would delete values, and never a default with no value yet. */
function defaultPick(suggestions: readonly SuggestedTransform[], entries: number): SuggestedTransform | null {
	const first = suggestions[0];
	if (!first) return null;
	if (first.op === "dropField" && entries > 0) return null;
	if (first.op === "setDefault" && first.value === "") return null;
	return first;
}

interface Checked {
	readonly parsed: SchemaFile;
	readonly next: Cms;
}

/** Checks the edited content: the file format, then the rules between collections that `defineSite` checks. */
function checkEdit(cms: Cms, schema: unknown): { issues: SchemaIssue[]; checked?: Checked } {
	let parsed: SchemaFile;
	try {
		parsed = parseSchemaFile(schema);
	} catch (error) {
		if (error instanceof SchemaFileError) return { issues: [...error.issues] };
		throw error;
	}
	try {
		return { issues: [], checked: { parsed, next: cms.forSchema(parsed) } };
	} catch (error) {
		return { issues: [issueFromError(error, Object.keys(parsed.collections))] };
	}
}

/** Whether a transform was picked for a decision: it names the same field (and the same removed option). */
function answers(transform: SuggestedTransform, change: SchemaChange): boolean {
	switch (change.kind) {
		case "field_removed":
			return (
				transform.collection === change.collection &&
				((transform.op === "renameField" && transform.from === change.field) ||
					(transform.op === "dropField" && transform.field === change.field))
			);
		case "option_removed":
			return (
				transform.op === "mapOption" &&
				transform.collection === change.collection &&
				transform.field === change.field &&
				transform.from === change.option
			);
		case "field_added":
		case "field_required_changed":
			return (
				transform.op === "setDefault" && transform.collection === change.collection && transform.field === change.field
			);
		default:
			return false;
	}
}

interface Evaluation {
	readonly checked: Checked;
	readonly store: Pick<SchemaChangeStore, "readSchemaState" | "appliedSchemaTransforms" | "scanBodies">;
	readonly applied: SchemaState | null;
	readonly pending: readonly SchemaMigration[];
	readonly preview: SchemaEditPreview;
}

/** Everything the preview and the save agree on: the diff against what is applied (or the running schema), the decisions, and the transforms in effect. */
async function evaluate(
	cms: Cms,
	input: SchemaEditInput,
): Promise<Evaluation | { readonly issues: readonly SchemaIssue[] }> {
	const { issues, checked } = checkEdit(cms, input.schema);
	if (!checked) return { issues };
	const { parsed, next } = checked;
	const store = next.store();
	let applied: SchemaState | null = null;
	let migrationsTable = true;
	try {
		applied = await store.readSchemaState();
	} catch (error) {
		if (!isMissingTable(error)) throw error;
		migrationsTable = false;
	}
	const own = parsed.migrations ?? [];
	let done: string[] = [];
	try {
		done = migrationsTable ? await store.appliedSchemaTransforms(own.map((item) => item.id)) : [];
	} catch (error) {
		if (!isMissingTable(error)) throw error;
	}
	const ownPending = own.filter((item) => !done.includes(item.id));
	const old = (applied?.schema ?? snapshotSchema(cms.site)) as unknown as SchemaLike;
	const target = next.site.config as SchemaLike;

	// The decisions come from the diff as the file has it (without the new picks): that is where a rename is a removal and an addition.
	const base = diffSchema(old, target, { transforms: ownPending });
	const asked = new Map(
		(input.renames ?? []).map((item) => [
			`${item.kind}:${item.collection}:${item.kind === "option" ? item.field : ""}:${item.from}`,
			item.to,
		]),
	);
	const optionsOf = (collection: string, field: string): string[] => {
		const stored = next.site.storedField(collection, field)?.field;
		return stored?.kind === "select" ? Object.keys(stored.options) : [];
	};
	const hasField = (collection: string, field: string) => Boolean(next.site.storedField(collection, field));
	const hintTargets = (change: SchemaChange): string[] => {
		if (change.kind !== "field_removed") return [];
		const asHint = (hint: RenameHint) =>
			hint.scope === "field" && hint.collection === change.collection && hint.from === change.field;
		const fromDiff = base.renameHints.filter(asHint).map((hint) => hint.to);
		const said = asked.get(`field:${change.collection}::${change.field}`);
		return [...new Set([...(said ? [said] : []), ...fromDiff])].filter((to) => hasField(change.collection, to));
	};
	const optionTargets = (change: SchemaChange): string[] => {
		if (change.kind !== "option_removed") return [];
		const options = optionsOf(change.collection, change.field);
		const said = asked.get(`option:${change.collection}:${change.field}:${change.option}`);
		return said && options.includes(said) ? [said, ...options.filter((option) => option !== said)] : options;
	};
	const suggest = (change: SchemaChange): SuggestedTransform[] => {
		if (change.kind === "field_removed") return suggestTransforms(change, { renameTo: hintTargets(change) });
		if (change.kind === "option_removed") return suggestTransforms(change, { options: optionTargets(change) });
		if (change.kind === "field_added" || change.kind === "field_required_changed") {
			return suggestTransforms(change, { options: optionsOf(change.collection, change.field) });
		}
		return [];
	};
	const asking = base.changes
		.map((change) => ({ change, suggestions: suggest(change) }))
		.filter((item) => item.suggestions.length > 0);

	// Impact of the decisions as they stand (no transform) is read in the same scan as the impact of the diff with the picks.
	const impactOfBase = await checkSchemaChange(
		store,
		{ changes: asking.map((item) => item.change), renameHints: [] },
		{ site: next.site },
	);

	const explicit = input.transforms;
	const picks: (SuggestedTransform | null)[] = asking.map((item, index) => {
		if (explicit) return explicit.find((transform) => answers(transform, item.change)) ?? null;
		return defaultPick(item.suggestions, impactOfBase.impacts[index]?.entries ?? 0);
	});
	// Picks that answer no decision (a transform the screen holds for something else) are kept as they are.
	const extra = (explicit ?? []).filter((transform) => !asking.some((item) => answers(transform, item.change)));
	const chosenRaw = [...picks.filter((pick): pick is SuggestedTransform => pick !== null), ...extra];

	const currentVersion = cms.site.config.schemaVersion ?? 1;
	const fileVersion = parsed.schemaVersion ?? 1;
	const taken = new Set(own.map((item) => item.id));
	// The version is decided by whether anything changes, which the transforms do not alter: a diff, or transforms pending.
	const changesData = base.changes.length > 0 || chosenRaw.length > 0 || ownPending.length > 0;
	const nextVersion = applied
		? changesData
			? Math.max(fileVersion, applied.schemaVersion + 1)
			: Math.max(fileVersion, applied.schemaVersion)
		: changesData
			? Math.max(fileVersion, currentVersion + 1)
			: fileVersion;
	const chosen = chosenRaw.map(
		(transform) => ({ ...transform, id: idFor(transform, nextVersion, taken) }) as SchemaMigration,
	);
	const pending = [...ownPending, ...chosen];
	const problems = checkTransforms(next.site, pending);

	const effective = diffSchema(old, target, { transforms: pending });
	const impact = await checkSchemaChange(store, effective, { site: next.site, transforms: pending });

	const decisions: SchemaDecision[] = asking.map((item, index) => ({
		key: impactOfBase.impacts[index]?.key ?? "",
		change: item.change,
		entries: impactOfBase.impacts[index]?.entries ?? 0,
		sample: impactOfBase.impacts[index]?.sample ?? [],
		suggestions: item.suggestions,
		chosen: picks[index] ?? null,
	}));

	const current = (() => {
		try {
			return JSON.stringify(JSON.parse(readFileSync(cms.schemaFile() ?? "", "utf8")));
		} catch {
			return undefined;
		}
	})();
	const differs = current === undefined || current !== JSON.stringify(parsed);
	const preview: SchemaEditPreview = {
		valid: true,
		issues: [],
		changed: differs || effective.changes.length > 0 || chosen.length > 0 || ownPending.length > 0,
		impacts: impact.impacts,
		decisions,
		transforms: chosen,
		problems,
		nextVersion,
		currentVersion,
		baseline: applied ? "applied" : "file",
		bodiesRead: impact.bodiesRead,
	};
	return { checked, store, applied, pending, preview };
}

const invalid = (issues: readonly SchemaIssue[]): SchemaEditPreview => ({
	valid: false,
	issues,
	changed: false,
	impacts: [],
	decisions: [],
	transforms: [],
	problems: [],
	nextVersion: 0,
	currentVersion: 0,
	baseline: "file",
	bodiesRead: 0,
});

/**
 * Checks an edit without writing anything: the diff against the schema last applied to the dev database (or against the running schema when none was applied),
 * the entries each change touches, the changes that need a pick of a data transform, and the problems of the picks. Needs the same access as a save.
 */
export async function previewSchemaEdit(cms: Cms, input: SchemaEditInput): Promise<SchemaEditPreview> {
	const evaluation = await evaluate(cms, input);
	return "issues" in evaluation ? invalid(evaluation.issues) : evaluation.preview;
}

export interface SchemaSaveInput extends SchemaEditInput {
	/** The hash of the file the edit started from (`SchemaScreenState.hash`). A different one means the file changed meanwhile. */
	readonly baseHash: string;
}

export type SchemaSaveResult =
	| { readonly saved: false; readonly reason: "invalid"; readonly issues: readonly SchemaIssue[] }
	| { readonly saved: false; readonly reason: "problems"; readonly problems: readonly TransformProblem[] }
	| { readonly saved: false; readonly reason: "conflict" }
	| { readonly saved: false; readonly reason: "unchanged" }
	| {
			readonly saved: true;
			readonly file: string;
			readonly hash: string;
			readonly schemaVersion: number;
			/** The transforms appended to `migrations` and run. */
			readonly transforms: readonly SchemaMigration[];
			/** Entries the apply rewrote. */
			readonly entriesRewritten: number;
			readonly types: { readonly file: string; readonly changed: boolean };
			/** The running instance now runs the new schema. */
			readonly reloaded: boolean;
			/** Entries where a rename found a value under the new name already: both were kept. */
			readonly conflicts: number;
	  }
	| {
			/** The file was written but the apply failed: nothing in the database changed; `monti schema:apply` runs it again. */
			readonly saved: false;
			readonly reason: "apply_failed";
			readonly message: string;
			readonly file: string;
			readonly hash: string;
	  };

/** `next` with `key` set: in place when the key is there, else right after the first of `after` that is. */
function withKey(
	content: Record<string, unknown>,
	key: string,
	value: unknown,
	after: readonly string[],
): Record<string, unknown> {
	if (key in content) return { ...content, [key]: value };
	const keys = Object.keys(content);
	const anchor = after.find((name) => keys.includes(name));
	const index = anchor === undefined ? 0 : keys.indexOf(anchor) + 1;
	const entries = Object.entries(content);
	entries.splice(index, 0, [key, value]);
	return Object.fromEntries(entries);
}

/**
 * Saves an edit, in this order, stopping at the first failure:
 *
 * 1. Checks the edit (format, then the rules between collections) and the transforms; refuses a file that changed since the edit started (`baseHash`).
 * 2. Dry-runs the transforms on the dev database (nothing written) so an entry that cannot be rewritten stops the save before the file is touched.
 * 3. Writes `monti.schema.json` with the chosen transforms appended to `migrations` and `schemaVersion` raised, keeping the file's formatting and key order.
 * 4. Writes the generated types (`monti-env.d.ts`).
 * 5. Runs `applySchemaChange` against the dev database (creating the tables first when the store has none) with the schema as written.
 * 6. Reloads the running instance from the file (`cms.reloadSchema()`).
 *
 * The caller has checked `schemaEditAccess`.
 */
export async function saveSchemaEdit(cms: Cms, input: SchemaSaveInput): Promise<SchemaSaveResult> {
	const access: SchemaEditAccess = schemaEditAccess(cms);
	if (!access.writable) throw new Error("the schema file is not writable here");
	const file = access.file;
	const previousText = readFileSync(file, "utf8");
	if (hashOf(previousText) !== input.baseHash) return { saved: false, reason: "conflict" };

	const evaluation = await evaluate(cms, input);
	if ("issues" in evaluation) return { saved: false, reason: "invalid", issues: evaluation.issues };
	const { preview } = evaluation;
	if (preview.problems.length > 0) return { saved: false, reason: "problems", problems: preview.problems };
	if (!preview.changed) return { saved: false, reason: "unchanged" };

	// What goes into the file: the edit as the writer arranged it (its key order), with the new transforms and the version.
	const raw = JSON.parse(JSON.stringify(input.schema)) as Record<string, unknown>;
	let content = raw;
	if (preview.transforms.length > 0) {
		const before = Array.isArray(raw.migrations) ? raw.migrations : [];
		content = withKey(content, "migrations", [...before, ...preview.transforms], ["collections"]);
	}
	const version = preview.nextVersion;
	if (version !== (typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1)) {
		content = withKey(content, "schemaVersion", version, ["$schema"]);
	}
	const final = content;
	const text = formatSchemaText(previousText, final);

	// The schema as it will be written, for the apply and the dry run.
	const written = JSON.parse(text) as unknown;
	const target = cms.forSchema(written);
	const migrations = (parseSchemaFile(written).migrations ?? []) as readonly SchemaMigration[];
	const options = { site: target.site, store: target.store(), migrations, schemaVersion: version };
	try {
		await applySchemaChange({ ...options, dryRun: true });
	} catch (error) {
		if (error instanceof SchemaChangeError) {
			return {
				saved: false,
				reason: "problems",
				problems: error.problems.length ? error.problems : [{ id: "", message: error.message }],
			};
		}
		if (!isMissingTable(error)) throw error;
	}

	writeFileSync(file, text);
	const types = generateSchemaTypes({ cwd: path.dirname(file), schema: path.basename(file) });
	const hash = hashOf(text);

	let applied: Awaited<ReturnType<typeof applySchemaChange>>;
	try {
		try {
			applied = await applySchemaChange(options);
		} catch (error) {
			if (!isMissingTable(error)) throw error;
			await cms.migrate({ log: () => {} });
			applied = await applySchemaChange(options);
		}
	} catch (error) {
		cms.reloadSchema();
		return {
			saved: false,
			reason: "apply_failed",
			message: error instanceof Error ? error.message : String(error),
			file: relativeToCwd(file),
			hash,
		};
	}
	const reload = cms.reloadSchema();
	return {
		saved: true,
		file: relativeToCwd(file),
		hash,
		schemaVersion: applied.schemaVersion,
		transforms: preview.transforms,
		entriesRewritten: applied.result.entries,
		types: { file: relativeToCwd(path.resolve(path.dirname(file), types.out)), changed: types.changed },
		reloaded: reload.reloaded,
		conflicts: applied.conflicts.length,
	};
}

export { SchemaChangeError };
export type { SchemaIssue };
