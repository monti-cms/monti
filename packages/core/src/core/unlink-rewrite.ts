import type { SiteSchemas } from "../schema/derive";
import type { Site } from "../site";
import { prepareSnapshot } from "./snapshot";
import type { UnlinkBody, UnlinkedBody, UnlinkParams } from "./store/trash";

/** The metadata of the body without the targets in its relation fields, or `null` when no relation field holds one. */
function withoutTargets(fields: Pick<SiteSchemas, "storedFields">, body: UnlinkBody, targets: ReadonlySet<string>) {
	const metadata: Record<string, unknown> = { ...body.metadata };
	let changed = false;
	for (const { name, field } of fields.storedFields(body.collection)) {
		if (field.kind !== "relation") continue;
		const value = metadata[name];
		if (typeof value === "string" && targets.has(value)) {
			delete metadata[name];
			changed = true;
		} else if (Array.isArray(value)) {
			const rest = value.filter((id) => !(typeof id === "string" && targets.has(id)));
			if (rest.length === value.length) continue;
			changed = true;
			if (rest.length > 0) metadata[name] = rest;
			else delete metadata[name];
		}
	}
	return changed ? metadata : null;
}

/**
 * The rewrite the store's unlink calls for each body that points at a target: the body as the write rules prepare it once the targets are out of its relation
 * fields. The trash unlink and the drop of a collection both use it. `fields` says which fields are relations (the site's own by default); the drop reads them
 * from the schema last applied, because the new schema cannot have a relation to the collection that goes. A body of a collection the site does not have is left as it is.
 */
export function createUnlinkRewrite(
	site: Site,
	fields: Pick<SiteSchemas, "storedFields"> = site,
): UnlinkParams["rewrite"] {
	return async (body, targets): Promise<UnlinkedBody | null> => {
		if (!site.isCollection(body.collection)) return null;
		const metadata = withoutTargets(fields, body, targets);
		if (!metadata) return null;
		const snapshot = await prepareSnapshot(
			site,
			{ collection: body.collection, slug: null, metadata, doc: body.doc } as never,
			{ previousMetadata: body.metadata, previousDoc: body.doc },
		);
		return {
			metadata: snapshot.metadata as never,
			doc: snapshot.doc,
			contentHash: snapshot.contentHash,
			references: snapshot.references.flatMap((ref) => {
				const occurrences = ref.occurrences.filter((occurrence) => occurrence.type === "metadata");
				return occurrences.length === 0 ? [] : [{ kind: ref.kind, targetId: ref.targetId, occurrences }];
			}),
		};
	};
}
