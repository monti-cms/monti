import { perSite, type Site } from "@monti-cms/core/client";
import { canonicalDocument, type StoredDocument, withoutBlockIds } from "@monti-cms/core/document";

/** `JSON.stringify` with the keys of every object sorted, so the same value is the same text wherever it was built (Postgres `jsonb` reorders keys). */
const stableStringify = (value: unknown): string => {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	const members = Object.keys(value)
		.sort()
		.flatMap((key) => {
			const member = (value as Record<string, unknown>)[key];
			return member === undefined ? [] : [`${JSON.stringify(key)}:${stableStringify(member)}`];
		});
	return `{${members.join(",")}}`;
};

/** A document is not changed in place, so its key is worked out once (per site: the order of marks is the site's). */
const keysOf = perSite((_site: Pick<Site, "sortMarks">) => new WeakMap<StoredDocument, string>());

/**
 * What a document says, as a string: the same body reads the same whichever way it was made. Block ids are not content, trailing empty paragraphs and the way text
 * is split into runs do not change what a body says (`canonicalDocument`), and key order does not either. The editor, the draft and the recovery copy compare
 * bodies by this key.
 */
export const documentKey = (site: Pick<Site, "sortMarks">, doc: StoredDocument): string => {
	const keys = keysOf(site);
	const known = keys.get(doc);
	if (known !== undefined) return known;
	const key = stableStringify(withoutBlockIds(canonicalDocument(site, doc).content));
	keys.set(doc, key);
	return key;
};
