import { CmsError, type Entry, type Issue, ServiceError } from "@monti-cms/core/plugin/server";
import { type ParsedEntryFile, RelationImportError, resolveRelations } from "./entry-file";
import type { ResolvedTarget } from "./options";
import type { SyncRecord } from "./state";
import { GitSyncError, type SyncContext } from "./sync";

/** Writing what a file says into the CMS: the pieces the published import (`inbound.ts`) and the draft import (`draft-inbound.ts`) share. */

/** A readable description of why a write failed: the error code and what the pipeline found, not a stack trace. */
export function describeError(error: unknown): string {
	if (error instanceof ServiceError) {
		const issues = (error.issues ?? []) as readonly Issue[];
		const found = issues
			.map((issue) => [issue.path, issue.code, issue.message].filter(Boolean).join(" "))
			.filter(Boolean);
		return found.length > 0 ? `${error.code}: ${found.slice(0, 5).join("; ")}` : error.code;
	}
	if (error instanceof RelationImportError) return `relations: ${error.message}`;
	return error instanceof Error ? error.message || error.name : String(error);
}

/** The entry as it is now, or `null` when it does not exist. */
export async function readEntry(ctx: SyncContext, entryId: string): Promise<Entry | null> {
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
	// Relations are written as slugs in a file; the pipeline takes ids.
	const metadata = await resolveRelations(cms, input.file, { collection: input.collection, locale: input.locale });
	const body = {
		collection: input.collection,
		slug: input.slug,
		metadata,
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

/**
 * Writes a file read from a draft branch into the entry's draft, without publishing it. Same pipeline as {@link applyFile} (hooks, validation, references); the
 * file being written is marked, so the save this causes is not pushed back.
 */
export async function applyDraftFile(
	ctx: SyncContext,
	target: ResolvedTarget,
	input: FileToApply & { readonly entry: Entry },
): Promise<Entry> {
	const { cms } = ctx;
	const metadata = await resolveRelations(cms, input.file, { collection: input.collection, locale: input.locale });
	await ctx.state.applying.mark(target.id, input.path, ctx.now());
	ctx.importing.add(target.id);
	try {
		return await cms.contentService().saveDraft(
			input.entry.id,
			{
				collection: input.collection,
				slug: input.slug,
				metadata,
				body: input.file.body,
				format: target.format,
				expectedVersion: input.entry.version,
			} as never,
			{ publishImmediately: false },
		);
	} finally {
		ctx.importing.delete(target.id);
		await ctx.state.applying.clear(target.id, input.path).catch(() => undefined);
	}
}
