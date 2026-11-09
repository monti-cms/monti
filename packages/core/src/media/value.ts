import { z } from "zod";

/** A media field's value in an entry: the file, and what it says in this entry (doc 09: alt text belongs to the entry, not the library). */
export const MediaValueShape = z.object({
	media: z.string().min(1),
	alt: z.string().optional(),
	decorative: z.boolean().optional(),
});
export type MediaValue = z.infer<typeof MediaValueShape>;

/** A media value as it is kept: no empty alt text and no switch that is off, so two values that say the same thing are the same value (a translation's marks compare them). */
export function cleanMediaValue({ alt, decorative, ...rest }: MediaValue): MediaValue {
	return { ...rest, ...(alt ? { alt } : {}), ...(decorative ? { decorative } : {}) };
}

/** The one rule for a picture with nothing to say for it (doc 09): not decorative, and alt text that is empty or only spaces. */
export const altIsMissing = (value: { alt?: unknown; decorative?: unknown }) =>
	value.decorative !== true && (typeof value.alt !== "string" || value.alt.trim() === "");

/** A stored value read back: `null` for anything that is not a media value (a field that changed kind, an empty value). */
export function mediaValueOf(value: unknown): MediaValue | null {
	const parsed = MediaValueShape.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** Where a file is used in its owner: a field, or a body block. */
export type MediaPlace = { field: string } | { block: string };

export const placeKey = (place: MediaPlace) => ("field" in place ? `field:${place.field}` : `block:${place.block}`);

export function placeOf(key: string): MediaPlace {
	return key.startsWith("field:") ? { field: key.slice("field:".length) } : { block: key.slice("block:".length) };
}
