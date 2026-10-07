import { CmsError, type Entry, type Issue, ServiceError } from "@monti-cms/core/plugin/server";
import { exportEntry, isSyncable, type ParsedEntryFile, parseEntryFile, sameContent } from "./entry-file";
import type { ResolvedTarget } from "./options";
import { flushTarget, isKnownBlob } from "./outbound";
import type { ConflictReason, ConflictRecord, PullSummary, SyncRecord } from "./state";
import { entryKey } from "./state";
import { GitSyncError, type SyncContext } from "./sync";

/**
 * Inbound: from the repo to the CMS.
 *
 * A pull compares the files of the target's folder with what was last synced (`SyncRecord`). A file whose blob is the one git-sync wrote (or read) is skipped.
 * A changed or new file is read into an entry through the target's format and written with the same pipeline as an edit in the admin (`cms.contentService()`:
 * hooks, validation, references), then published. If the entry also changed on the server since the last sync, nothing is written: a conflict is recorded
 * and a person picks a side.
 */

/** A readable description of why a write failed: the error code and what the pipeline found, not a stack trace. */
export function describeError(error: unknown): string {
	if (error instanceof ServiceError) {
		const issues = (error.issues ?? []) as readonly Issue[];
		const found = issues
			.map((issue) => [issue.path, issue.code, issue.message].filter(Boolean).join(" "))
			.filter(Boolean);
		return found.length > 0 ? `${error.code}: ${found.slice(0, 5).join("; ")}` : error.code;
	}
	return error instanceof Error ? error.message || error.name : String(error);
}

/** The entry as it is now, or `null` when it does not exist. */
async function readEntry(ctx: SyncContext, entryId: string): Promise<Entry | null> {
	try {
		return await ctx.cms.store().getEntry(entryId);
	} catch (error) {
		if (error instanceof CmsError && error.code === "not_found") return null;
		throw error;
	}
}

/** What a file says, with the place it was found. */
export interface FileToApply {
	readonly path: string;
	readonly sha: string;
	readonly file: ParsedEntryFile;
	readonly collection: string;
	readonly locale: string;
	readonly slug: string;
}

export interface Applied {
	readonly entry: Entry & { published: NonNullable<Entry["published"]> };
	readonly created: boolean;
}

/**
 * Writes a file to the CMS and publishes it: an existing entry takes the file's fields and body as its draft and publishes it; with no entry, one is created
 * (a translation from its source). Blocked states are cleared first (a trashed entry is restored, an archived one unarchived). Every step is the content
 * service's, so hooks, validation and the references of the body run as for any edit. The files being written are marked, so the publishes this causes are
 * not pushed back.
 */
export async function applyFile(
	ctx: SyncContext,
	target: ResolvedTarget,
	input: FileToApply & {
		readonly entry: Entry | null;
		/** The entry an id in `translationOf` stands for, when it was created in this pull. */
		readonly resolveSource?: (id: string) => string | undefined;
	},
): Promise<Applied> {
	const { cms } = ctx;
	const service = cms.contentService();
	const body = {
		collection: input.collection,
		slug: input.slug,
		metadata: input.file.metadata,
		body: input.file.body,
		format: target.format,
	};
	await ctx.state.applying.mark(target.id, input.path, ctx.now());
	ctx.importing.add(target.id);
	try {
		let current = input.entry;
		let created = false;
		if (current) {
			if (current.status === "trashed")
				current = await service.restore({ id: current.id, expectedVersion: current.version });
			else if (current.status === "archived") {
				current = await cms.store().unarchiveEntry({ id: current.id, expectedVersion: current.version });
			}
		} else if (input.locale === cms.site.DEFAULT_LOCALE || cms.site.isItemCollection(input.collection)) {
			const entry = await service.createDraft(body as never, { publishImmediately: true });
			return { entry: entry as Applied["entry"], created: true };
		} else {
			const sourceId = input.file.translationOf
				? (input.resolveSource?.(input.file.translationOf) ?? input.file.translationOf)
				: undefined;
			if (!sourceId) {
				throw new GitSyncError(
					`${input.path} is a "${input.locale}" file with no entry yet; add \`monti.translationOf\` (the id of the source entry) to its front matter`,
				);
			}
			current = await service.createTranslation({ sourceId, locale: input.locale });
			created = true;
		}
		const saved = await service.saveDraft(current.id, { ...body, expectedVersion: current.version } as never, {
			publishImmediately: false,
		});
		const { entry } = await service.publish({ id: current.id, expectedVersion: saved.version });
		return { entry: entry as Applied["entry"], created };
	} finally {
		ctx.importing.delete(target.id);
		await ctx.state.applying.clear(target.id, input.path).catch(() => undefined);
	}
}

/** The record of an entry synced from a file. */
export const recordOf = (
	target: ResolvedTarget,
	file: Pick<FileToApply, "path" | "sha">,
	applied: Applied,
	now: number,
): SyncRecord => ({
	target: target.id,
	entryId: applied.entry.id,
	collection: applied.entry.collection,
	locale: applied.entry.locale,
	slug: applied.entry.publishedSlug ?? "",
	path: file.path,
	blobSha: file.sha,
	baseSha: file.sha,
	contentHash: applied.entry.published.contentHash,
	syncedAt: new Date(now).toISOString(),
});

const conflictOf = (
	target: ResolvedTarget,
	entry: Pick<Entry, "id" | "collection" | "locale">,
	fields: { kind: ConflictRecord["kind"]; reason: ConflictReason; path: string; sha: string; text: string },
	now: number,
): ConflictRecord => ({
	id: entryKey(target.id, entry.id),
	target: target.id,
	entryId: entry.id,
	collection: entry.collection,
	locale: entry.locale,
	kind: fields.kind,
	reason: fields.reason,
	path: fields.path,
	gitSha: fields.sha,
	gitText: fields.text,
	detectedAt: new Date(now).toISOString(),
});

/**
 * Pulls one target: reads the files of its folder at the head of the branch and applies what changed. A file that cannot be applied is reported in `errors`
 * and does not stop the others. Returns what happened (also kept for the admin screen).
 */
export async function pullTarget(ctx: SyncContext, target: ResolvedTarget): Promise<PullSummary> {
	const summary = await ctx.withLock(target, async () => {
		const client = await ctx.client(target);
		const { pattern } = await ctx.format(target);
		const head = await client.getBranchHead(target.branch);
		if (!head) throw new GitSyncError(`The branch "${target.branch}" does not exist in ${target.repo}`);
		const files = await client.listFiles(head, target.folder);
		const records = await ctx.state.records.list(target.id);
		const byPath = new Map([...records.values()].map((record) => [record.path, record]));
		const open = new Map((await ctx.state.conflicts.list(target.id)).map((conflict) => [conflict.entryId, conflict]));
		const created = new Map<string, string>();
		const skipped: { path: string; reason: string }[] = [];
		const errors: { path: string; message: string }[] = [];
		let applied = 0;
		let createdCount = 0;
		let unchanged = 0;
		let conflicts = 0;

		// The default language first: a translation may point to a source created from a file of the same pull.
		const candidates = [...files]
			.filter(([path]) => pattern.parse(path) !== null)
			.sort(([a], [b]) => {
				const rank = (path: string) =>
					(pattern.parse(path)?.locale ?? ctx.cms.site.DEFAULT_LOCALE) === ctx.cms.site.DEFAULT_LOCALE ? 0 : 1;
				return rank(a) - rank(b) || (a < b ? -1 : 1);
			});

		for (const [path, sha] of candidates) {
			try {
				const known = byPath.get(path);
				if (known && isKnownBlob(known, sha)) {
					if (sha === known.blobSha && known.baseSha !== sha) await ctx.state.records.put({ ...known, baseSha: sha });
					unchanged += 1;
					continue;
				}
				const text = await client.getBlob(sha);
				const parsed = parseEntryFile(text);
				if (!parsed.ok) {
					errors.push({ path, message: parsed.message });
					continue;
				}
				const { file } = parsed;
				const where = pattern.parse(path) ?? {};
				const collection =
					file.collection ?? where.collection ?? (target.collections.length === 1 ? target.collections[0] : undefined);
				if (!collection || !target.collections.includes(collection)) {
					skipped.push({
						path,
						reason: `not a file of this target's collections${collection ? ` ("${collection}")` : ""}`,
					});
					continue;
				}
				const locale = file.locale ?? where.locale ?? ctx.cms.site.DEFAULT_LOCALE;
				if (!ctx.cms.site.isLocale(locale)) {
					errors.push({ path, message: `the language "${locale}" is not one of the site's languages` });
					continue;
				}
				const slug = file.slug ?? where.slug;
				if (!slug) {
					errors.push({
						path,
						message: "the file has no slug: add `slug` to its front matter, or use {slug} in the target's path",
					});
					continue;
				}

				// Which entry is this file? The one synced from this path, else the one the file names, else the published entry at its address.
				let entry: Entry | null = null;
				let record = known;
				if (record) entry = await readEntry(ctx, record.entryId);
				if (!entry && file.id) {
					const found = await readEntry(ctx, created.get(file.id) ?? file.id);
					if (found && found.collection === collection && found.locale === locale) entry = found;
				}
				if (!entry && !record) {
					const lookup = await ctx.cms
						.store()
						.getPublishedEntryBySlug({ collection, slug, locale, includeBody: false });
					if (lookup.status === "current") entry = await readEntry(ctx, lookup.entry.id);
				}
				if (entry) {
					const own = records.get(entry.id);
					if (own && own.path !== path) {
						if (files.has(own.path)) {
							skipped.push({ path, reason: `the same entry already has the file ${own.path}` });
							continue;
						}
						// The file moved (git mv): it is the entry's file now.
						record = own;
					}
					record ??= own;
				}

				const found = { path, sha, file, collection, locale, slug };
				const subject =
					entry ?? (record ? { id: record.entryId, collection: record.collection, locale: record.locale } : null);
				if (subject) {
					const existing = open.get(subject.id);
					if (existing) {
						if (existing.gitSha !== sha) {
							await ctx.state.conflicts.put({
								...existing,
								path,
								gitSha: sha,
								gitText: text,
								detectedAt: new Date(ctx.now()).toISOString(),
							});
						}
						conflicts += 1;
						continue;
					}
				}
				if (!entry && record) {
					// The entry is gone from the server (deleted) while its file was edited in git.
					await ctx.state.conflicts.put(
						conflictOf(
							target,
							subject ?? { id: record.entryId, collection, locale },
							{ kind: "removed", reason: "git-edit-blocks-removal", path, sha, text },
							ctx.now(),
						),
					);
					conflicts += 1;
					continue;
				}
				if (entry) {
					const reason = await serverSide(ctx, target, pattern, entry, record, text);
					if (reason === "in-sync") {
						await ctx.state.records.put(syncedRecord(target, entry, found, ctx.now()));
						unchanged += 1;
						continue;
					}
					if (reason !== "unchanged") {
						const conflict = conflictOf(
							target,
							entry,
							{ kind: isSyncable(entry, target) ? "changed" : "removed", reason, path, sha, text },
							ctx.now(),
						);
						await ctx.state.conflicts.put(conflict);
						conflicts += 1;
						continue;
					}
				}

				const result = await applyFile(ctx, target, {
					...found,
					entry,
					resolveSource: (id) => created.get(id),
				});
				await ctx.state.records.put(recordOf(target, found, result, ctx.now()));
				if (file.id) created.set(file.id, result.entry.id);
				if (result.created) createdCount += 1;
				else applied += 1;
			} catch (error) {
				errors.push({ path, message: describeError(error) });
			}
		}

		for (const record of records.values()) {
			if (files.has(record.path)) continue;
			if (record.blobSha === null) {
				// The pull request that removes it has merged.
				await ctx.state.records.remove(target.id, record.entryId);
			} else {
				skipped.push({
					path: record.path,
					reason:
						"removed in git; the entry stays published (unpublish it in the CMS to remove it for good), and its next publish writes the file again",
				});
			}
		}

		const done: PullSummary = {
			at: new Date(ctx.now()).toISOString(),
			head: head.commitSha,
			applied,
			created: createdCount,
			unchanged,
			conflicts,
			skipped,
			errors,
		};
		await ctx.state.status.patch(target.id, { lastPull: done });
		return done;
	});
	// Publishes that came in while the files were being written wait in the queue: commit them now that the lock is free.
	if ((await ctx.state.queue.list(target.id)).length > 0) {
		await flushTarget(ctx, target).catch((error) =>
			console.error(`[git-sync] flush of ${target.id} after a pull failed`, error),
		);
	}
	return summary;
}

/** The record of an entry whose file already says what the entry says. */
const syncedRecord = (
	target: ResolvedTarget,
	entry: Entry,
	file: Pick<FileToApply, "path" | "sha">,
	now: number,
): SyncRecord => ({
	target: target.id,
	entryId: entry.id,
	collection: entry.collection,
	locale: entry.locale,
	slug: entry.publishedSlug ?? "",
	path: file.path,
	blobSha: file.sha,
	baseSha: file.sha,
	contentHash: entry.published?.contentHash ?? null,
	syncedAt: new Date(now).toISOString(),
});

/**
 * Where the server stands against a changed file: `unchanged` (the git version can be applied), `in-sync` (the file says what the entry already says), or the
 * reason a person has to decide.
 */
async function serverSide(
	ctx: SyncContext,
	target: ResolvedTarget,
	pattern: Awaited<ReturnType<SyncContext["format"]>>["pattern"],
	entry: Entry,
	record: SyncRecord | undefined,
	gitText: string,
): Promise<"unchanged" | "in-sync" | ConflictReason> {
	if (!record) {
		// Never synced: it is only safe when the file says the same thing.
		if (isSyncable(entry, target)) {
			const exported = await exportEntry(ctx.cms, target, pattern, entry);
			if (sameContent(exported.text, gitText)) return "in-sync";
		}
		return "unsynced";
	}
	if (!isSyncable(entry, target)) return "git-edit-blocks-removal";
	if (record.contentHash !== entry.published.contentHash || record.slug !== entry.publishedSlug) return "both-changed";
	// A draft with changes the file does not have would be replaced by the import.
	if (entry.working.contentHash !== entry.published.contentHash) return "unpublished-changes";
	return "unchanged";
}
