import {
	parseTranslationState,
	RECORD_TRANSLATIONS_KEY,
	type SchemaCollection,
	type Site,
	type StoredDocument,
	type StoredField,
	type TranslationState,
} from "@monti-cms/core/client";
import { emptyStoredDocument, STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { documentKey } from "../../editor/document-key";
import { entriesMessages } from "./messages";

/**
 * The value of one form input. Text, single relation, select and date are strings (a single relation is `null` when empty); multi relations are arrays.
 * The body is the one value that is a document (`form.doc`).
 */
export type FormValue = string | string[] | StoredDocument | null;

/**
 * Draft values the edit screen handles. Fields other than title, slug and body come from the collection definition and
 * are stored flat, keyed by field name. Date fields hold the `datetime-local` input value (in the configured time zone).
 */
export type EntryForm = { title: string; slug: string; doc: StoredDocument } & { [field: string]: FormValue };

/** Partial form change. Only the given keys are changed. */
export type EntryFormPatch = { readonly [field: string]: FormValue };

export const EMPTY_FORM: EntryForm = { title: "", slug: "", doc: emptyStoredDocument() };

/**
 * Title of a duplicate (by library convention the title field is named `title`). Appends a "copy" suffix to the source title and trims the source part
 * if it would exceed the title field's `max`.
 */
export function copyTitle(site: Site, collection: string, title: string | null | undefined): string {
	const t = site.createTranslator(entriesMessages);
	// The suffix added to a duplicate's title and the name for an untitled source are screen text, so the admin screen decides them, not the repository.
	const copySuffix = t("copy.suffix");
	const base = title?.trim() ? title : t("untitled");
	const field = site.isCollection(collection) ? site.storedField(collection, "title")?.field : undefined;
	const max = field?.kind === "text" ? field.max : undefined;
	const room = max === undefined ? Number.POSITIVE_INFINITY : max - Array.from(copySuffix).length;
	const chars = Array.from(base);
	if (room <= 0) return chars.slice(0, max).join("");
	return `${chars.length > room ? chars.slice(0, room).join("") : base}${copySuffix}`;
}

/** Content in the same translation group. */
export interface TranslationMember {
	id: string;
	locale: string;
	status: EntryData["status"];
	isSource: boolean;
	title: string | null;
	workingSlug: string | null;
}

export interface EntryData {
	id: string;
	collection: string;
	/** Content language and translation group ID. For the original, the group ID is its own ID. */
	locale?: string;
	translationGroupId?: string;
	translations?: TranslationMember[];
	/** For a translation, the latest draft metadata of the original. Shown read-only as the shared values. */
	source?: {
		id: string;
		locale: string;
		status: EntryData["status"];
		workingSlug: string | null;
		metadata: Record<string, unknown>;
		/** Latest draft body of the original (translation screen), a stored document. Its block ids pair the blocks with the confirmed source's. */
		doc?: StoredDocument;
	};
	status: "draft" | "published" | "archived" | "trashed";
	version: number;
	folderId: string | null;
	publishedAt?: string;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: {
		metadata: Record<string, unknown>;
		/** The body as a stored document with block ids (one `unparsed` node when it could not be read as a document). */
		doc: StoredDocument;
		translation?: TranslationState | null;
	};
	published?: { metadata: Record<string, unknown>; doc: StoredDocument };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Reads a form value as a string. Empty string if missing or an array. */
export const formText = (form: EntryForm, name: string): string => text(form[name]);

/** Reads a form value as a string array. */
export const formList = (form: EntryForm, name: string): string[] => {
	const value = form[name];
	return Array.isArray(value) ? value : [];
};

/** Whether this is a translation. A translation handles only per-language values as the form. */
export const isTranslationEntry = (entry: Pick<EntryData, "id" | "translationGroupId"> | null | undefined) =>
	Boolean(entry?.translationGroupId && entry.translationGroupId !== entry.id);

/** The original shown on the translation screen. Only present for a translation that received the original body. */
export interface TranslationSource {
	/** The original's stored document (an `unparsed` body is one `unparsed` node). */
	doc: StoredDocument;
	locale: string;
	title: string;
}

/** For a translation, the original's body, language and title. Used by the source pane, the title hint and AI translation. */
export function translationSourceOf(entry: EntryData | null): TranslationSource | null {
	if (!entry || !isTranslationEntry(entry) || !entry.source?.doc) return null;
	const title = entry.source.metadata.title;
	return {
		doc: entry.source.doc,
		locale: entry.source.locale,
		title: typeof title === "string" ? title : "",
	};
}

/** Stored fields the form handles. For a translation, only fields that are `localized` in the definition (shared values belong to the original). */
const fieldsOf = (site: Site, collection: string, translation = false): readonly StoredField[] => {
	if (!site.isCollection(collection)) return [];
	const fields = site.storedFields(collection as SchemaCollection);
	if (!translation) return fields;
	const { own, inherit } = site.localizedFieldNames(collection as SchemaCollection);
	return fields.filter(({ name }) => own.includes(name) || inherit.includes(name));
};

/** Form key holding the translation state. Starts with `$` so it never collides with a stored field name. The value is a JSON string. */
export const TRANSLATION_FORM_KEY = "$translation";

/**
 * JSON string of the translation state. Fixes the key order (also inside the document) so the fingerprint matches values from the server
 * (JSONB reorders keys). A document that is not a valid stored document is left out.
 */
export const stringifyTranslation = (state: TranslationState) =>
	JSON.stringify(parseTranslationState(state) ?? UNCONFIRMED_TRANSLATION);

/** The state of a translation that has confirmed nothing: an empty source. */
const UNCONFIRMED_TRANSLATION: TranslationState = {
	version: 4,
	baseDoc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [] },
};

/** Form value -> translation state. If missing or malformed, nothing is treated as confirmed (an empty source document). */
export const translationStateFromForm = (value: FormValue | undefined): TranslationState => {
	if (typeof value === "string") {
		try {
			const parsed = parseTranslationState(JSON.parse(value));
			if (parsed) return parsed;
		} catch {
			// A corrupted value is treated as unconfirmed.
		}
	}
	return UNCONFIRMED_TRANSLATION;
};

/** Form value -> `translation` of the save request. Not sent if it is not a translation (no key). */
export const translationPayload = (form: EntryForm): TranslationState | undefined => {
	const value = form[TRANSLATION_FORM_KEY];
	if (typeof value !== "string") return undefined;
	return translationStateFromForm(value);
};

/** Stored value -> input value. */
function toFormValue({ field }: StoredField, value: unknown): FormValue {
	switch (field.kind) {
		case "text":
		case "media":
			return text(value);
		case "relation":
			if (field.many) return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
			return text(value) || null;
		case "select":
			// A value that is no longer an option is shown as it is stored: the input marks it, and saving keeps it.
			return typeof value === "string" && value !== "" ? value : field.defaultValue;
	}
}

export function formFromEntry(site: Site, entry: EntryData): EntryForm {
	const metadata = entry.working.metadata ?? {};
	const form: EntryForm = { title: text(metadata.title), slug: entry.workingSlug ?? "", doc: entry.working.doc };
	for (const stored of fieldsOf(site, entry.collection, isTranslationEntry(entry))) {
		if (stored.name === "title" || stored.field.hidden) continue;
		form[stored.name] = toFormValue(stored, metadata[stored.name]);
	}
	Object.assign(form, recordTranslationsToForm(site, entry.collection, metadata));
	// A translation also handles translation state as the form, so autosave, recovery and conflict comparison see it along with the body.
	if (isTranslationEntry(entry)) {
		// If it is not a valid state, use an empty source so "source changed" is shown. A state of an older version is read as version 4.
		form[TRANSLATION_FORM_KEY] = stringifyTranslation(
			parseTranslationState(entry.working.translation) ?? UNCONFIRMED_TRANSLATION,
		);
	}
	return form;
}

/** Form key for per-language values of a record collection. E.g. `title@en`. */
export const recordTranslationKey = (field: string, locale: string) => `${field}@${locale}`;

function recordTranslationsToForm(
	site: Site,
	collection: string,
	metadata: Record<string, unknown>,
): Record<string, string> {
	if (!site.isCollection(collection)) return {};
	const translations = (metadata[RECORD_TRANSLATIONS_KEY] ?? {}) as Record<string, Record<string, unknown>>;
	const values: Record<string, string> = {};
	for (const field of site.recordLocalizedFields(collection as SchemaCollection)) {
		for (const locale of site.PREFIXED_LOCALES)
			values[recordTranslationKey(field, locale)] = text(translations[locale]?.[field]);
	}
	return values;
}

/** Converts original metadata to form values. Used when the translation's properties panel shows shared values read-only. */
export function formFromSourceMetadata(site: Site, collection: string, metadata: Record<string, unknown>): EntryForm {
	const form: EntryForm = { title: text(metadata.title), slug: "", doc: emptyStoredDocument() };
	for (const stored of fieldsOf(site, collection)) {
		if (stored.name === "title" || stored.field.hidden) continue;
		form[stored.name] = toFormValue(stored, metadata[stored.name]);
	}
	return form;
}

/**
 * Fingerprint for comparing form values. Compares the recovery copy with the server-saved one. The body counts by what it says (`documentKey`): the same
 * body made by the editor, the source panel or the server is the same, whatever the block ids and the order of keys (the form's own keys are sorted too, so a
 * recovery copy that was upgraded from an older shape compares like any other).
 */
export const formFingerprint = (site: Site, form: EntryForm) =>
	JSON.stringify(
		Object.fromEntries(
			Object.keys(form)
				.sort()
				.map((key) => [key, key === "doc" ? documentKey(site, form.doc) : form[key]]),
		),
	);

/**
 * Form -> stored metadata. Rules come from the collection definition.
 *
 * - Required text (title) is stored as typed. For optional text and relations, an empty value removes the key so the public page falls back to the default.
 * - Optional fields are not newly written when they hold the default. Already stored values are updated as is.
 * - Values attached to a conditional field are kept only when the condition holds.
 * - Fields that render no input (`hidden`) do not touch the stored value. Keys not in the definition are not added.
 * - Values of removed fields (keys of `base` that are not in the definition) and a select value that is no longer an option stay as stored.
 */
export function metadataFromForm(
	site: Site,
	form: EntryForm,
	collection: string,
	base: Record<string, unknown> = {},
	options: { translation?: boolean } = {},
): { metadata: Record<string, unknown> } | { error: string } {
	const fields = fieldsOf(site, collection, options.translation);
	const metadata: Record<string, unknown> = {};
	// The form has no input for the value of a removed field, so it goes back as stored instead of being dropped.
	if (site.isCollection(collection)) {
		for (const key of Object.keys(base)) {
			if (site.isOrphanedMetadataKey(collection as SchemaCollection, key)) metadata[key] = base[key];
		}
	}
	for (const { name } of fields) {
		if (Object.hasOwn(base, name)) metadata[name] = base[name];
	}
	const values: Record<string, FormValue> = { ...form };

	for (const { name, field, when } of fields) {
		if (field.hidden) continue;
		const active = !when || values[when.field] === when.value;
		const value = values[name];
		if (!active) {
			delete metadata[name];
			continue;
		}
		switch (field.kind) {
			case "text":
			case "media": {
				const raw = text(value);
				if (field.required) metadata[name] = raw;
				else if (raw.trim()) metadata[name] = raw.trim();
				else delete metadata[name];
				break;
			}
			case "relation":
				if (field.many) {
					if (Array.isArray(value) && value.length > 0) metadata[name] = value;
					else delete metadata[name];
				} else if (typeof value === "string" && value.trim()) metadata[name] = value.trim();
				else delete metadata[name];
				break;
			case "select": {
				// An option the site removed stays while it is the stored value; it is never replaced by the default.
				const stored = typeof value === "string" && value !== "" && Object.hasOwn(base, name) && base[name] === value;
				const selected =
					typeof value === "string" && (Object.hasOwn(field.options, value) || stored) ? value : field.defaultValue;
				if (selected !== field.defaultValue || Object.hasOwn(base, name)) metadata[name] = selected;
				else delete metadata[name];
				break;
			}
		}
	}

	// Per-language name and description of a record collection. Empty languages are not added.
	const localizedRecordFields = site.isCollection(collection)
		? site.recordLocalizedFields(collection as SchemaCollection)
		: [];
	if (localizedRecordFields.length > 0) {
		const translations: Record<string, Record<string, string>> = {};
		for (const locale of site.PREFIXED_LOCALES) {
			for (const field of localizedRecordFields) {
				const value = text(values[recordTranslationKey(field, locale)]).trim();
				if (value) translations[locale] = { ...translations[locale], [field]: value };
			}
		}
		if (Object.keys(translations).length > 0) metadata[RECORD_TRANSLATIONS_KEY] = translations;
		else delete metadata[RECORD_TRANSLATIONS_KEY];
	}
	return { metadata };
}
