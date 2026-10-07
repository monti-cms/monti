import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { Cms } from "../../cms";
import { CmsError, type Entry } from "../../core/store";
import { ServiceError } from "../../core/types";
import type { StoredDocument } from "../../doc/stored-document";
import { importText } from "../../format/convert";
import { describeError } from "./errors";
import { guessCollections, guessFieldMappings, resolveQuestions } from "./guess";
import { buildLinkIndex, rewriteLinks } from "./links";
import { type ImportMapping, loadMapping, saveMapping } from "./mapping";
import { createMediaImporter, imageSources, type MediaImporter, withMediaIds } from "./media";
import { type FilePlan, formatForExtension, groupId, type Notice, planFiles } from "./plan";
import { confirm, type Prompter } from "./prompt";
import { createRelationResolver, type RelationResolver } from "./relations";
import {
	type CollectionCounts,
	describeMapping,
	type FileNotice,
	type FileResult,
	type FileStatus,
	type ImportReport,
	summarize,
} from "./report";
import { type ParsedSource, readSource, type SourceExtension, scanSources } from "./source";
import { type FileRecord, importState } from "./state";

/**
 * `monti import <path>`: the whole run. Scan, read the front matter, guess and confirm the mapping, plan every file, then (unless it is a dry run) write
 * through the content service, the one write pipeline: validation and hooks run for an import exactly as for an edit in the admin.
 *
 * The writes go in passes, because a post can link to a post that does not exist yet:
 * 1. every file becomes a draft (the default-language files first, then their translations), with images uploaded and relations resolved;
 * 2. the bodies whose links pointed to files without an entry are saved again with those links turned into entry links;
 * 3. with `--publish`, the entries whose front matter is not a draft are published.
 */

export interface ImportOptions {
	readonly cms: Cms;
	readonly cwd: string;
	/** The folder (or file) to import. */
	readonly target: string;
	/** The mapping file. */
	readonly mappingFile: string;
	readonly dryRun?: boolean;
	readonly publish?: boolean;
	/** Replace entries that were edited in the CMS since the last import. */
	readonly overwrite?: boolean;
	/** `--collection`: the collection every folder goes to. */
	readonly collection?: string;
	/** `--format`: the format of every file. */
	readonly format?: string;
	/** Asks the questions. Without one, every question takes its non-interactive answer. */
	readonly prompter?: Prompter;
	readonly log?: (line: string) => void;
}

/** A failure the person can act on: nothing was written. */
export class ImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ImportError";
	}
}

const MDX_HINT = 'add the MDX plugin to monti.config.ts: `plugins: [mdx()]` (import { mdx } from "@monti-cms/mdx")';

const toNotices = (list: readonly Notice[]): FileNotice[] => list.map(({ kind, message }) => ({ kind, message }));

/** The folder `/images/a.png` is served from: `public` (Next, Astro) or `static` (Hugo, SvelteKit), in the folder of the posts or above it. */
function findPublicDir(cwd: string, root: string): string | undefined {
	for (let dir = root; ; dir = path.dirname(dir)) {
		for (const name of ["public", "static"]) {
			const candidate = path.join(dir, name);
			if (existsSync(candidate) && statSync(candidate).isDirectory()) {
				return path.relative(cwd, candidate).split(path.sep).join("/");
			}
		}
		if (dir === cwd || dir === path.dirname(dir)) return undefined;
	}
}

/** A position in the body as a line of the file. */
function whereIn(source: ParsedSource, position: { line?: number } | undefined): string {
	return position?.line === undefined ? "" : `line ${position.line + source.bodyLineOffset}: `;
}

interface Written {
	readonly plan: FilePlan;
	entry: Entry;
	/** The body with images resolved and links as written: what the second pass resolves again. */
	readonly baseDoc: StoredDocument;
	readonly linksPending: boolean;
	readonly created: boolean;
	readonly notices: Notice[];
	toPublish: boolean;
	publishError?: string;
}

export async function runImport(options: ImportOptions): Promise<ImportReport> {
	const { cms, cwd } = options;
	const site = cms.site;
	const dryRun = options.dryRun === true;
	const publish = options.publish === true;
	const _log = options.log ?? (() => undefined);
	const notes: string[] = [];

	const { root, files } = scanSources(cwd, options.target);
	if (files.length === 0) throw new ImportError(`no .md or .mdx files found in ${options.target}`);

	const formats = await cms.formats();
	const existingMapping = loadMapping(options.mappingFile);
	for (const ext of new Set(files.map((file) => file.ext))) {
		if (
			!formatForExtension(
				formats,
				ext as SourceExtension,
				existingMapping ?? { version: 1, folders: {} },
				options.format,
			)
		) {
			throw new ImportError(noFormatMessage(ext, options.format));
		}
	}

	const sources = files.map(readSource);
	const rootName = path.basename(root);
	const scanned = path.relative(cwd, root).split(path.sep).join("/") || ".";

	// 1. The mapping: guess what the saved one does not decide, ask what is unclear, confirm.
	const guess = guessCollections(site, sources, {
		collection: options.collection,
		existing: existingMapping,
		rootName,
	});
	const mapping: ImportMapping = guess.mapping;
	let asked = guess.questions.length;
	notes.push(...(await resolveQuestions(guess.questions, options.prompter)));
	// The fields depend on the collection, so they are guessed once the folders have theirs.
	const fieldGuess = guessFieldMappings(site, sources, mapping);
	asked += fieldGuess.questions.length;
	notes.push(...(await resolveQuestions(fieldGuess.questions, options.prompter)));
	for (const note of [...guess.notes, ...fieldGuess.notes]) notes.push(note);
	if (!mapping.publicDir) {
		const found = findPublicDir(cwd, root);
		if (found) mapping.publicDir = found;
	}
	const changed = JSON.stringify(mapping) !== JSON.stringify(existingMapping);
	if (options.prompter && (asked > 0 || !existingMapping)) {
		options.prompter.note(describeMapping(mapping, scanned).join("\n"), "The mapping I will use");
		if (!(await confirm(options.prompter, dryRun ? "Looks right?" : "Use it and save it for the next run?", true))) {
			throw new ImportError(
				`stopped: nothing was written. Edit ${path.basename(options.mappingFile)} (or run again) and try once more`,
			);
		}
	}
	let mappingSaved = false;
	if (!dryRun && changed) {
		saveMapping(options.mappingFile, mapping);
		mappingSaved = true;
	}

	// 2. The plan.
	const plans = planFiles(sources, { site, mapping, formats, format: options.format });
	const importable = plans.filter((plan) => !plan.skip && plan.errors.length === 0 && plan.collection);

	const state = importState(cms);
	try {
		await state.file("probe");
	} catch (error) {
		if ((error as { code?: string }).code === "42P01") {
			throw new ImportError("the database has no Monti tables yet; run `monti migrate` first");
		}
		throw error;
	}
	const publicDirs = [mapping.publicDir ? path.resolve(cwd, mapping.publicDir) : undefined, root].filter(
		(dir): dir is string => dir !== undefined,
	);
	const media = createMediaImporter({ cms, state, publicDirs, dryRun });
	const relations = createRelationResolver({ cms, dryRun });
	const index = buildLinkIndex(site, importable);

	const results = new Map<FilePlan, FileResult>();
	const ids = new Map<string, { entryId: string; groupId: string }>();
	const written: Written[] = [];
	let linksResolved = 0;
	let linksUnresolved = 0;

	const record = (plan: FilePlan, status: FileStatus, reason: string, extra: Partial<FileResult> = {}) => {
		results.set(plan, {
			path: plan.source.key,
			status,
			reason,
			...(plan.collection ? { collection: plan.collection } : {}),
			locale: plan.locale,
			slug: plan.slug,
			notices: toNotices(plan.warnings),
			...extra,
		});
	};

	for (const plan of plans) {
		if (plan.skip) record(plan, "skipped", plan.skip);
		else if (plan.errors.length > 0) {
			record(plan, "failed", plan.errors.map((error) => error.message).join("; "));
		}
	}

	// The default language first: a translation is made from its source.
	const ordered = [...importable].sort(
		(a, b) =>
			Number(a.locale !== site.DEFAULT_LOCALE) - Number(b.locale !== site.DEFAULT_LOCALE) ||
			(a.source.key < b.source.key ? -1 : 1),
	);

	const idOf = (plan: FilePlan) => ids.get(plan.source.key)?.groupId ?? (dryRun ? "dry-run" : undefined);

	/** The body of a file as a document, with images and relations resolved. */
	async function prepare(plan: FilePlan, previous: StoredDocument | null) {
		const notices: Notice[] = [];
		const imported = await importText(site, formats, plan.format as string, plan.source.body, {
			locale: plan.locale,
			previous,
		});
		if (imported.issues.length > 0) {
			const message = imported.issues
				.map((issue) => `${whereIn(plan.source, issue.position)}${issue.message ?? issue.code}`)
				.join("; ");
			return { error: { kind: "parse_error", message } as Notice, notices };
		}
		let doc = imported.doc;
		const sources = imageSources(doc.content);
		const mediaIds = new Map<string, string>();
		for (const src of sources) {
			const found = await media.resolve(src, plan.source.abs);
			if (found?.mediaId) mediaIds.set(src, found.mediaId);
			if (found?.warning) notices.push({ kind: "image", message: found.warning });
		}
		if (mediaIds.size > 0) doc = { ...doc, content: [...withMediaIds(doc.content, mediaIds)] };

		const metadata: Record<string, string | string[]> = { ...plan.values };
		for (const use of plan.relations) {
			const resolved: string[] = [];
			for (const value of use.values) {
				const found = await relations.resolve(use.to, value, use.create);
				if (found.id) resolved.push(found.id);
				if (found.warning) notices.push({ kind: "relation", message: found.warning });
			}
			if (resolved.length > 0) metadata[use.field] = use.many ? resolved : (resolved[0] as string);
		}
		for (const use of plan.mediaFields) {
			const found = await media.resolve(use.value, plan.source.abs);
			if (found?.mediaId) metadata[use.field] = found.mediaId;
			else if (found?.warning) notices.push({ kind: "image", message: `${use.key}: ${found.warning}` });
			else if (!found)
				notices.push({
					kind: "image",
					message: `${use.key}: "${use.value}" is a URL and ${use.field} takes a media item, so it is skipped`,
				});
		}
		return { doc, metadata, notices, error: undefined };
	}

	const service = cms.contentService();
	const store = cms.store();
	const readEntry = async (id: string): Promise<Entry | null> => {
		try {
			return await store.getEntry(id);
		} catch (error) {
			if (error instanceof CmsError && error.code === "not_found") return null;
			throw error;
		}
	};

	const now = () => new Date().toISOString();
	const recordOf = (plan: FilePlan, entry: Entry, groupIdOf: string, hash: string): FileRecord => ({
		entryId: entry.id,
		groupId: groupIdOf,
		collection: entry.collection,
		locale: entry.locale,
		slug: entry.workingSlug ?? plan.slug,
		hash,
		published: entry.status === "published",
		version: entry.version,
		importedAt: now(),
	});

	// 3. Pass 1: every file becomes (or updates) a draft.
	const toPublishOnly: { plan: FilePlan; entry: Entry; previous: FileRecord }[] = [];
	for (const plan of ordered) {
		try {
			const key = plan.source.key;
			let previous = await state.file(key);
			const entry = previous ? await readEntry(previous.entryId) : null;
			if (previous && !entry) previous = undefined;
			const wantsPublish = publish && !plan.draft && !site.isItemCollection(plan.collection as string);

			if (previous && entry && previous.hash === plan.hash) {
				ids.set(key, { entryId: previous.entryId, groupId: previous.groupId });
				if (wantsPublish && entry.status !== "published") {
					toPublishOnly.push({ plan, entry, previous });
					record(plan, "updated", dryRun ? "would be published" : "published (it was imported as a draft before)", {
						entryId: entry.id,
						state: "published",
					});
				} else {
					record(plan, "skipped", "unchanged since the last import", {
						entryId: entry.id,
						state: entry.status === "published" ? "published" : "draft",
					});
				}
				continue;
			}
			// A record with no hash is one an earlier run left half way (the entry exists, its content was not written): that is not an edit in the CMS.
			if (previous && entry && previous.hash !== "" && entry.version !== previous.version && !options.overwrite) {
				ids.set(key, { entryId: previous.entryId, groupId: previous.groupId });
				record(
					plan,
					"skipped",
					"the entry was edited in the CMS since the last import; run with --overwrite to replace it",
					{
						entryId: entry.id,
					},
				);
				continue;
			}
			if (entry && (entry.status === "trashed" || entry.status === "archived")) {
				ids.set(key, { entryId: entry.id, groupId: previous?.groupId ?? entry.translationGroupId });
				record(plan, "skipped", `the entry is ${entry.status} in the CMS`, { entryId: entry.id });
				continue;
			}

			const source =
				plan.locale === site.DEFAULT_LOCALE
					? undefined
					: ordered.find(
							(other) =>
								groupId(other) === groupId(plan) && other.locale === site.DEFAULT_LOCALE && ids.has(other.source.key),
						);
			if (plan.locale !== site.DEFAULT_LOCALE && !source) {
				record(plan, "failed", `its ${site.DEFAULT_LOCALE} file was not imported, so there is no entry to translate`);
				continue;
			}

			const prepared = await prepare(plan, entry ? entry.working.doc : null);
			if (prepared.error) {
				record(plan, "failed", prepared.error.message, { notices: [] });
				continue;
			}
			const rewritten = rewriteLinks(prepared.doc, plan, index, idOf);
			// A body with links to files that have no entry yet is counted in the second pass, when those links are known.
			if (rewritten.pending.size === 0) linksResolved += rewritten.resolved;
			linksUnresolved += rewritten.unresolved.length;
			const notices: Notice[] = [
				...plan.warnings,
				...prepared.notices,
				...rewritten.unresolved.map((message) => ({ kind: "link", message }) as Notice),
				...(rewritten.droppedFragments > 0
					? [
							{
								kind: "link",
								message: `${rewritten.droppedFragments} link(s) had a #section or ?query, which an entry link cannot keep`,
							} as Notice,
						]
					: []),
			];

			if (dryRun) {
				ids.set(key, { entryId: entry?.id ?? "dry-run", groupId: entry?.translationGroupId ?? "dry-run" });
				record(plan, entry ? "updated" : "imported", entry ? "would be updated from the file" : "would be created", {
					notices: toNotices(notices),
					state: wantsPublish ? "published" : "draft",
				});
				continue;
			}

			const input = {
				collection: plan.collection as string,
				slug: plan.slug,
				metadata: prepared.metadata,
				doc: rewritten.doc,
			};
			let saved: Entry;
			let created = false;
			if (entry) {
				saved = (await service.saveDraft(entry.id, { ...input, expectedVersion: entry.version } as never, {
					publishImmediately: false,
				})) as Entry;
			} else if (!source) {
				saved = (await service.createDraft(input as never, {
					publishImmediately: site.isItemCollection(input.collection) ? undefined : false,
				})) as Entry;
				created = true;
			} else {
				const sourceIds = ids.get(source.source.key) as { entryId: string; groupId: string };
				const blank = (await service.createTranslation({ sourceId: sourceIds.groupId, locale: plan.locale })) as Entry;
				// Remember the entry before filling it in, so a failure does not leave one that the next run would try to create again.
				await state.putFile(key, recordOf(plan, blank, sourceIds.groupId, ""));
				saved = (await service.saveDraft(blank.id, { ...input, expectedVersion: blank.version } as never, {
					publishImmediately: false,
				})) as Entry;
				created = true;
			}
			ids.set(key, { entryId: saved.id, groupId: saved.translationGroupId });
			await state.putFile(key, recordOf(plan, saved, saved.translationGroupId, ""));
			written.push({
				plan,
				entry: saved,
				baseDoc: prepared.doc,
				linksPending: rewritten.pending.size > 0,
				created,
				notices,
				toPublish: wantsPublish,
			});
		} catch (error) {
			record(plan, "failed", describeError(error));
		}
	}

	// 4. Pass 2: bodies that linked to files that had no entry yet.
	for (const item of written) {
		if (!item.linksPending) continue;
		try {
			const again = rewriteLinks(item.baseDoc, item.plan, index, idOf);
			if (again.resolved > 0) {
				const saved = (await service.saveDraft(
					item.entry.id,
					{
						collection: item.plan.collection,
						slug: item.plan.slug,
						metadata: (await store.getWorking({ entryId: item.entry.id })).metadata,
						doc: again.doc,
						expectedVersion: item.entry.version,
					} as never,
					{ publishImmediately: false },
				)) as Entry;
				item.entry = saved;
			}
			linksResolved += again.resolved;
			// The first pass counted the links to files without an entry as nothing; what is still without one is left as written.
			for (const target of again.pending) {
				item.notices.push({
					kind: "link",
					message: `a link to ${target.source.rel} was left as written: that file was not imported`,
				});
				linksUnresolved += 1;
			}
		} catch (error) {
			item.notices.push({
				kind: "link",
				message: `links to other posts were left as written (${describeError(error)})`,
			});
		}
	}

	// 5. Pass 3: publish.
	if (!dryRun) {
		for (const item of written) {
			if (!item.toPublish) continue;
			try {
				const { entry } = await service.publish({
					id: item.entry.id,
					expectedVersion: item.entry.version,
					...(item.plan.publishedAt ? { publishedAt: item.plan.publishedAt } : {}),
				});
				item.entry = entry as Entry;
			} catch (error) {
				item.toPublish = false;
				item.publishError = describeError(error);
				if (!(error instanceof ServiceError)) throw error;
			}
		}
		for (const { plan, entry, previous } of toPublishOnly) {
			try {
				const { entry: published } = await service.publish({
					id: entry.id,
					expectedVersion: entry.version,
					...(plan.publishedAt ? { publishedAt: plan.publishedAt } : {}),
				});
				await state.putFile(plan.source.key, recordOf(plan, published as Entry, previous.groupId, plan.hash));
			} catch (error) {
				record(plan, "failed", `could not be published: ${describeError(error)}`, { entryId: entry.id });
			}
		}
	}

	// 6. The results of the written files, and the memory for the next run.
	for (const item of written) {
		const { plan } = item;
		const isPublished = item.entry.status === "published";
		const notices = [...item.notices];
		let reason: string;
		if (item.publishError) {
			notices.push({ kind: "publish", message: item.publishError });
			reason = `${item.created ? "created" : "updated"} as a draft; publishing was blocked`;
		} else if (isPublished) reason = item.created ? "created and published" : "updated and published";
		else if (plan.draft) reason = `${item.created ? "created" : "updated"} as a draft (its front matter says draft)`;
		else if (item.created) reason = publish ? "created as a draft" : "created as a draft (use --publish to publish)";
		else
			reason = publish
				? "updated; the draft was saved"
				: "updated; the draft was saved and the published version is unchanged (use --publish)";
		record(plan, item.created ? "imported" : "updated", reason, {
			entryId: item.entry.id,
			state: isPublished ? "published" : "draft",
			notices: toNotices(notices),
		});
		await state.putFile(plan.source.key, recordOf(plan, item.entry, item.entry.translationGroupId, plan.hash));
	}

	return buildReport({
		options,
		plans,
		results,
		mapping,
		mappingSaved,
		notes,
		media,
		relations,
		linksResolved,
		linksUnresolved,
		scanned,
	});
}

function buildReport(input: {
	readonly options: ImportOptions;
	readonly plans: readonly FilePlan[];
	readonly results: ReadonlyMap<FilePlan, FileResult>;
	readonly mapping: ImportMapping;
	readonly mappingSaved: boolean;
	readonly notes: readonly string[];
	readonly media: MediaImporter;
	readonly relations: RelationResolver;
	readonly linksResolved: number;
	readonly linksUnresolved: number;
	readonly scanned: string;
}): ImportReport {
	const files = input.plans.map((plan) => {
		const result = input.results.get(plan);
		return (
			result ?? {
				path: plan.source.key,
				status: "failed" as const,
				reason: "was not processed",
				notices: [],
			}
		);
	});
	const counts = { imported: 0, updated: 0, skipped: 0, failed: 0 };
	const collections: Record<string, CollectionCounts> = {};
	input.plans.forEach((plan, position) => {
		const file = files[position] as FileResult;
		counts[file.status] += 1;
		const name = plan.collection ?? "(not imported)";
		const entry = collections[name] ?? { files: 0, imported: 0, updated: 0, skipped: 0, failed: 0, translations: 0 };
		collections[name] = entry;
		entry.files += 1;
		entry[file.status] += 1;
		if (plan.collection && plan.locale !== input.options.cms.site.DEFAULT_LOCALE) entry.translations += 1;
	});
	const base = {
		dryRun: input.options.dryRun === true,
		path: input.scanned,
		publish: input.options.publish === true,
		mappingFile: path.basename(input.options.mappingFile),
		mappingSaved: input.mappingSaved,
		mapping: input.mapping,
		files,
		counts,
		collections,
		createdTargets: Object.fromEntries(input.relations.created),
		media: {
			uploaded: input.media.stats.uploaded,
			reused: input.media.stats.reused,
			wouldUpload: input.media.stats.wouldUpload,
			configured: input.media.configured,
		},
		links: { resolved: input.linksResolved, unresolved: input.linksUnresolved },
		notes: [
			...input.notes,
			...(input.media.configured ||
			!files.some((file) => file.notices.some((n) => n.kind === "image" && n.message.includes("no media storage")))
				? []
				: [
						"Local images stayed URLs because no media storage is configured (add `storage` to monti.config.ts, for example s3Storage()).",
					]),
		],
	};
	return { ...base, summary: summarize(base) };
}

function noFormatMessage(ext: string, forced: string | undefined): string {
	return forced
		? `--format ${forced}: the site has no importable format with that name; ${MDX_HINT}`
		: `no format is registered that reads .${ext} files; ${MDX_HINT}`;
}
