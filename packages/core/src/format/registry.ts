import { assertFormatName, type CmsFormat, type FormatInfo } from "./types";

/** The formats of one CMS instance, by name. */
export interface FormatRegistry {
	get(name: string): CmsFormat | undefined;
	list(): readonly CmsFormat[];
	/** What the meta API reports. */
	info(): readonly FormatInfo[];
}

/** Builds a registry. Two formats with one name are an error (the same rule as colliding plugin routes), found when the instance loads its plugins. */
export function createFormatRegistry(formats: readonly CmsFormat[]): FormatRegistry {
	const byName = new Map<string, CmsFormat>();
	for (const format of formats) {
		assertFormatName(format.name);
		if (byName.has(format.name)) throw new Error(`cms format: "${format.name}" is provided twice`);
		byName.set(format.name, format);
	}
	return {
		get: (name) => byName.get(name),
		list: () => [...byName.values()],
		info: () =>
			[...byName.values()].map((format) => ({
				name: format.name,
				label: format.label,
				mimeType: format.mimeType,
				extension: format.extension,
				canImport: typeof format.import === "function",
			})),
	};
}

/** A registry with no format. A CMS without a format plugin accepts documents only (`doc`), not text. */
export const NO_FORMATS: FormatRegistry = createFormatRegistry([]);
