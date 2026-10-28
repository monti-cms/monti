import { trashExpiresAt } from "@monti-cms/core/site";
import { testSite } from "../../../../../core/test/site";
import type { TrashEntryJson, TrashFolderJson, TrashItemJson, TrashMediaJson } from "../../../api/trash";

const DAY = 24 * 60 * 60 * 1000;

/** The day `days` ago, as the API writes dates. */
export const ago = (days: number): string => new Date(Date.now() - days * DAY - 60_000).toISOString();

/** A day of 2026 at noon in Seoul, for stories: the days left are counted to {@link STORY_NOW}, so a picture never changes with the date. */
export const at = (month: number, day: number): string =>
	`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00+09:00`;
export const STORY_NOW = new Date("2026-10-27T12:30:00+09:00");

const expires = (deletedAt: string): string => trashExpiresAt(new Date(deletedAt)).toISOString();

/** A document collection, an item collection (tags), and the language a translation is in, whatever the site's config. */
export const content = testSite.DEFAULT_COLLECTION;
export const record = testSite.COLLECTIONS.find((name) => testSite.isItemCollection(name)) ?? content;
export const other = testSite.COLLECTIONS.find((name) => name !== content && name !== record);
export const secondLocale = testSite.LOCALES.find((locale) => locale !== testSite.DEFAULT_LOCALE) ?? "en";

export const entry = (id: string, title: string, fields: Partial<TrashEntryJson> = {}): TrashEntryJson => {
	const deletedAt = fields.deletedAt ?? ago(0);
	return {
		type: "entry",
		id,
		collection: content,
		locale: testSite.DEFAULT_LOCALE,
		translationGroupId: id,
		isSource: true,
		title,
		slug: id,
		version: 3,
		deletedAt,
		expiresAt: expires(deletedAt),
		locales: [testSite.DEFAULT_LOCALE],
		everPublished: false,
		sourceTrashed: false,
		sourceTitle: null,
		path: [],
		usages: 0,
		...fields,
	};
};

export const folder = (id: string, name: string, fields: Partial<TrashFolderJson> = {}): TrashFolderJson => {
	const deletedAt = fields.deletedAt ?? ago(0);
	return {
		type: "folder",
		id,
		collection: content,
		name,
		version: 1,
		deletedAt,
		expiresAt: expires(deletedAt),
		path: [],
		entries: 2,
		folders: 0,
		files: 0,
		...fields,
	};
};

export const media = (id: string, filename: string, fields: Partial<TrashMediaJson> = {}): TrashMediaJson => {
	const deletedAt = fields.deletedAt ?? ago(2);
	return {
		type: "media",
		id,
		filename,
		mimeType: "image/jpeg",
		alt: "",
		byteSize: 2_516_582,
		width: 2400,
		height: 1600,
		folderId: null,
		deletedAt,
		expiresAt: expires(deletedAt),
		path: [],
		url: `/media/${filename}`,
		...fields,
	};
};

/** The key a unit's tab is under. */
export const kindOf = (item: TrashItemJson): string => (item.type === "media" ? "media" : item.collection);

/** The inside of a trashed folder: no date, the day belongs to the folder. */
export const inside = <T extends TrashItemJson>(item: T, ...path: string[]): T => ({ ...item, expiresAt: null, path });
