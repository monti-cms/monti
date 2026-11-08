import type { Kysely, Transaction } from "kysely";
import { asDoc, walk } from "../body/doc";
import type { Database } from "../db/schema";
import type { FieldDefinition } from "../schema/define";
import { altIsMissing, type MediaPlace, mediaValueOf } from "./value";

type Db = Kysely<Database> | Transaction<Database>;

/** An image with nothing to say for it: not decorative, and no alt text. */
export type AltGap = { media: string; place: MediaPlace };

/** The images of a body with no alt text, in order. A translation's body comes here as the site draws it (`bodyAsRead`): a block still pending is not on the site yet, and one following its source has the source's words. */
function gapsInDoc(doc: unknown): AltGap[] {
	const gaps: AltGap[] = [];
	for (const { block } of walk(asDoc(doc).blocks)) {
		const attrs = block.attrs ?? {};
		if (block.type !== "image") continue;
		if (typeof attrs.media === "string" && attrs.media !== "" && altIsMissing(attrs))
			gaps.push({ media: attrs.media, place: { block: block.id } });
	}
	return gaps;
}

/**
 * Where an entry's images have no alt text (doc 02's to-do list, `entries.missingAlt`): its fields, then its body. A field that takes any file holds an image only if
 * the library says so; one that takes images is an image whatever it points at.
 */
export async function altGaps(
	db: Db,
	fields: Record<string, FieldDefinition>,
	values: Record<string, unknown>,
	doc: unknown,
): Promise<AltGap[]> {
	const held = Object.entries(fields).flatMap(([field, definition]) => {
		if (definition.kind !== "media") return [];
		const value = mediaValueOf(values[field]);
		return value && altIsMissing(value) ? [{ field, definition, media: value.media }] : [];
	});
	const askAbout = held.filter(({ definition }) => definition.accept === "any").map(({ media }) => media);
	const images = new Set(
		askAbout.length === 0
			? []
			: (
					await db.selectFrom("media").select("id").where("id", "in", askAbout).where("kind", "=", "image").execute()
				).map((row) => row.id),
	);
	return [
		...held
			.filter(({ definition, media }) => definition.accept !== "any" || images.has(media))
			.map(({ field, media }) => ({ media, place: { field } })),
		...gapsInDoc(doc),
	];
}
