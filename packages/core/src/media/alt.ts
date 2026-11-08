import type { Kysely, Transaction } from "kysely";
import { asDoc, walk } from "../body/doc";
import type { Database } from "../db/schema";
import type { FieldDefinition } from "../schema/define";
import { type MediaPlace, mediaValueOf } from "./value";

type Db = Kysely<Database> | Transaction<Database>;

/** An image with nothing to say for it: not decorative, and no alt text. */
export type AltGap = { media: string; place: MediaPlace };

const blank = (alt: unknown) => typeof alt !== "string" || alt.trim() === "";

/** The images of a body with no alt text, in order. A block still in the source's words is not decided yet: the to-do list has its own row for that. */
function gapsInDoc(doc: unknown): AltGap[] {
	const gaps: AltGap[] = [];
	for (const { block } of walk(asDoc(doc).blocks)) {
		const attrs = block.attrs ?? {};
		if (block.type !== "image" || block.link?.state === "pending" || attrs.decorative === true) continue;
		if (typeof attrs.media === "string" && attrs.media !== "" && blank(attrs.alt))
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
		return value && value.decorative !== true && blank(value.alt) ? [{ field, definition, media: value.media }] : [];
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
