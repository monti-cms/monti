import { CmsError } from "../../core/store/errors";
import { mapLinkAttrs } from "../../doc/entry-links";
import { emptyStoredDocument, type StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import type { Issue } from "../types";
import type { ImportPlan, PlannedEntry } from "./plan";
import type { ImportHost, ImportReason } from "./types";

/** What happened in one step of one entry's import. */
export interface ImportStep {
	readonly status: "done" | "skipped" | "failed";
	readonly reason?: ImportReason;
}

export interface ImportEntryResult {
	/** The entry's name in the archive. */
	readonly key: string;
	/** The archive collection and the collection it went to. */
	readonly collection: string;
	readonly target: string | null;
	readonly locale: string;
	readonly title: string | null;
	readonly slug: string | null;
	/** The new entry's id, once its draft exists. */
	readonly id: string | null;
	/**
	 * `imported`: every step that was asked for is done. `draft`: the draft exists but a later step failed (the draft stays, and the step says why).
	 * `skipped`: nothing was written. `failed`: the draft could not be made.
	 */
	readonly outcome: "imported" | "draft" | "skipped" | "failed";
	readonly create: ImportStep;
	/** Saving the title, slug and body. `null` when the draft was not made. */
	readonly body: ImportStep | null;
	/** Publishing. `null` when it was not asked for, or the entry was not published in the archive. */
	readonly publish: ImportStep | null;
	/** What the writes found worth telling (a link that does not resolve, an image file that is missing). They never block. */
	readonly warnings: readonly Issue[];
	readonly notes: readonly ImportReason[];
}

const reasonOf = (error: unknown): ImportReason => {
	if (error instanceof CmsError) return { code: "write_failed", error };
	console.error("[cms] an entry import step failed unexpectedly", error);
	return { code: "unexpected" };
};

const failed = (error: unknown): ImportStep => ({ status: "failed", reason: reasonOf(error) });

/** The document with its links by id changed from the ids of the archive to the ids of the new entries. A link the map does not hold stays as it is. */
const withNewIds = (doc: StoredDocument, ids: ReadonlyMap<string, string>): StoredDocument => {
	const content = mapLinkAttrs(doc.content, (attrs) => {
		const target = typeof attrs.entryId === "string" ? ids.get(attrs.entryId) : undefined;
		return target ? { entryId: target } : undefined;
	});
	return content === doc.content ? doc : { ...doc, content: content as CmsNode[] };
};

/**
 * Writes the entries a plan accepted, in three steps so that the links between them resolve:
 * 1. every draft is made (the sources first, then each translation of its source), which reserves the slugs;
 * 2. every body is saved, with its title and slug (a link written as a path finds its entry, and a link by id is changed to the new id);
 * 3. with `publish`, the entries that were published in the archive are published.
 * Nothing is all-or-nothing: each entry records each step as done, skipped or failed, and a failure of a later step leaves the draft.
 */
export async function runImport(
	host: ImportHost,
	plan: ImportPlan,
	options: { publish: boolean },
): Promise<ImportEntryResult[]> {
	const service = host.contentService();
	const { site } = host;
	const accepted = plan.entries.filter((entry) => entry.skip === null);
	const ordered = [
		...accepted.filter((entry) => entry.source.isSource),
		...accepted.filter((entry) => !entry.source.isSource),
	];

	const created = new Map<string, { id: string; version: number }>();
	const createStep = new Map<string, ImportStep>();
	const newIdOfGroup = new Map<string, string>();

	// 1. Drafts.
	for (const item of ordered) {
		const { source, target } = item;
		if (!target) continue;
		try {
			if (source.isSource) {
				const metadata = { [site.titleField(target).name]: item.title };
				const { entry } = await service.createDraft({
					collection: target,
					...(item.slug ? { slug: item.slug } : {}),
					metadata,
					doc: emptyStoredDocument(),
				} as never);
				created.set(source.key, { id: entry.id, version: entry.version });
				newIdOfGroup.set(source.group, entry.id);
			} else {
				const sourceId = newIdOfGroup.get(source.group);
				if (!sourceId) {
					createStep.set(source.key, { status: "skipped", reason: { code: "source_skipped" } });
					continue;
				}
				const { entry } = await service.createTranslation({ sourceId, locale: source.locale });
				created.set(source.key, { id: entry.id, version: entry.version });
			}
			createStep.set(source.key, { status: "done" });
		} catch (error) {
			createStep.set(
				source.key,
				error instanceof CmsError && error.code === "slug_conflict"
					? { status: "skipped", reason: { code: "slug_exists", params: { slug: item.slug ?? "" } } }
					: failed(error),
			);
		}
	}

	// 2. Bodies.
	const bodyStep = new Map<string, ImportStep>();
	const warnings = new Map<string, Issue[]>();
	for (const item of ordered) {
		const draft = created.get(item.source.key);
		if (!draft || !item.target || !item.doc) continue;
		try {
			const { entry, warnings: found } = await service.saveDraft(draft.id, {
				collection: item.target,
				...(item.slug ? { slug: item.slug } : {}),
				metadata: { [site.titleField(item.target).name]: item.title },
				doc: withNewIds(item.doc, newIdOfGroup),
				expectedVersion: draft.version,
			} as never);
			created.set(item.source.key, { id: entry.id, version: entry.version });
			warnings.set(item.source.key, [...item.readIssues, ...found]);
			bodyStep.set(item.source.key, { status: "done" });
		} catch (error) {
			bodyStep.set(item.source.key, failed(error));
		}
	}

	// 3. Publishing.
	const publishStep = new Map<string, ImportStep>();
	if (options.publish) {
		for (const item of ordered) {
			const draft = created.get(item.source.key);
			if (!draft || !item.source.published) continue;
			if (bodyStep.get(item.source.key)?.status !== "done") {
				publishStep.set(item.source.key, { status: "skipped", reason: { code: "draft_missing" } });
				continue;
			}
			try {
				const { warnings: found } = await service.publish({ id: draft.id, expectedVersion: draft.version });
				warnings.set(item.source.key, [...(warnings.get(item.source.key) ?? []), ...found]);
				publishStep.set(item.source.key, { status: "done" });
			} catch (error) {
				publishStep.set(item.source.key, failed(error));
			}
		}
	}

	return plan.entries.map(
		(item): ImportEntryResult => resultOf(item, created, createStep, bodyStep, publishStep, warnings),
	);
}

function resultOf(
	item: PlannedEntry,
	created: ReadonlyMap<string, { id: string }>,
	createStep: ReadonlyMap<string, ImportStep>,
	bodyStep: ReadonlyMap<string, ImportStep>,
	publishStep: ReadonlyMap<string, ImportStep>,
	warnings: ReadonlyMap<string, Issue[]>,
): ImportEntryResult {
	const { source } = item;
	const base = {
		key: source.key,
		collection: source.collection,
		target: item.target,
		locale: source.locale,
		title: item.title,
		slug: item.slug,
		notes: item.notes,
	};
	if (item.skip) {
		return {
			...base,
			id: null,
			outcome: "skipped",
			create: { status: "skipped", reason: item.skip },
			body: null,
			publish: null,
			warnings: [],
		};
	}
	const create = createStep.get(source.key) ?? {
		status: "skipped" as const,
		reason: { code: "draft_missing" as const },
	};
	const id = created.get(source.key)?.id ?? null;
	if (create.status !== "done") {
		return {
			...base,
			id: null,
			outcome: create.status === "failed" ? "failed" : "skipped",
			create,
			body: null,
			publish: null,
			warnings: [],
		};
	}
	const body = bodyStep.get(source.key) ?? { status: "skipped" as const, reason: { code: "draft_missing" as const } };
	const publish = publishStep.get(source.key) ?? null;
	const clean = body.status === "done" && (publish === null || publish.status === "done");
	return {
		...base,
		id,
		outcome: clean ? "imported" : "draft",
		create,
		body,
		publish,
		warnings: warnings.get(source.key) ?? [],
	};
}
