import { isCollection, isItemCollection } from "../core/collections";
import { isLocale } from "../core/locales";
import { prepareSnapshot, serviceInputKeys, validateExactRecord } from "../core/snapshot";
import { withTranslationHints } from "../core/translation/hints";
import { confirmedSourceState } from "../core/translation/state";
import { slugFromValues } from "../schema/derive";
import { type SaveDraftInput, ServiceError, type ServiceInput, type StorePort } from "./types";

// Snapshot rules live in the domain layer (`core/snapshot`). Re-exported to keep the existing import path.
export { imageWarningsForPublish, prepareSnapshot, validateForPublish } from "../core/snapshot";

const assertInputKeys = (input: unknown, baseKeys: readonly string[]) => {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw new ServiceError("invalid_input");
	const withFolder = (input as { folderId?: unknown }).folderId !== undefined;
	validateExactRecord(input, withFolder ? [...baseKeys, "folderId"] : baseKeys);
};

/**
 * A record collection must be creatable by entering only a name. If the slug is empty, it is built from the value the address field's `from`
 * points to (not built if there is no `from`). An explicit save is itself a public update, so a record without a slug cannot exist.
 */
const withRecordSlug = (input: ServiceInput): ServiceInput => {
	if (!isItemCollection(input.collection) || input.slug?.trim()) return input;
	const slug = slugFromValues(input.collection, input.metadata ?? {});
	return slug ? { ...input, slug } : input;
};

export const createContentService = <T = unknown>(storePort: StorePort<T>) => ({
	/**
	 * Creates new content. A record collection is published right away by default (when `publishImmediately` is omitted).
	 */
	createDraft: async (input: ServiceInput, options?: { publishImmediately?: boolean }) => {
		assertInputKeys(input, serviceInputKeys(input));
		const { folderId, ...rest } = withRecordSlug(input);
		const snapshot = await prepareSnapshot(rest as ServiceInput);
		return storePort.createEntryWithReferences({
			snapshot,
			references: snapshot.references,
			folderId,
			publishImmediately: options?.publishImmediately ?? isItemCollection(input.collection),
		});
	},

	/**
	 * Saves the latest draft. A record collection by default applies to the public value together with the save.
	 */
	saveDraft: async (entryId: string, input: SaveDraftInput, options?: { publishImmediately?: boolean }) => {
		assertInputKeys(input, [
			...serviceInputKeys(input),
			"expectedVersion",
			// If the incoming value is not an object, `assertInputKeys` rejects it. Property reads (accessors) happen only after that.
			...(input && typeof input === "object" && Object.hasOwn(input, "translation") ? ["translation"] : []),
		]);
		const { expectedVersion, folderId, ...rest } = input;
		if (typeof expectedVersion !== "number" || expectedVersion <= 0 || !Number.isInteger(expectedVersion)) {
			throw new ServiceError("invalid_input");
		}

		const previousReferences = await storePort.getWorkingReferences({ entryId });
		// Blocks keep their ids across saves: a body sent as MDX carries none, so they are paired with the current draft's blocks.
		const { doc: previousDoc, metadata: previousMetadata } = await storePort.getWorking({ entryId });
		const snapshot = await prepareSnapshot(rest as ServiceInput, { previousReferences, previousDoc, previousMetadata });
		return storePort.saveWorkingWithReferences({
			entryId,
			expectedVersion,
			snapshot,
			references: snapshot.references,
			folderId,
			publishImmediately: options?.publishImmediately ?? isItemCollection(input.collection),
		});
	},

	/**
	 * Creates a translation. A draft whose structure follows the latest draft of the source (the source of the group), with the source text placed as translation notes.
	 * The address reuses the source address (languages differ, so they do not collide). The folder is the same as the source.
	 * If called on a translation, it is created from that group's source.
	 */
	createTranslation: async (params: { sourceId: string; locale: string }) => {
		if (!isLocale(params.locale)) throw new ServiceError("invalid_input");
		const picked = await storePort.getWorking({ entryId: params.sourceId });
		const sourceId = picked.translationGroupId ?? params.sourceId;
		const source = sourceId === params.sourceId ? picked : await storePort.getWorking({ entryId: sourceId });
		if (!isCollection(source.collection) || isItemCollection(source.collection)) {
			throw new ServiceError("invalid_input");
		}
		// A translation starts from the source skeleton. Structure (headings, paragraphs, boxes, lists, tables), code and images are kept, and text
		// becomes translation notes (faded source text). Per-language values such as title and summary are emptied (the edit screen shows the source title as a placeholder).
		// The translation state records the current source (its MDX and document) as the "confirmed source". If the source changes, the translation screen tells you.
		const snapshot = await prepareSnapshot({
			collection: source.collection,
			slug: source.slug,
			metadata: {},
			mdx: withTranslationHints(source.mdx),
			translation: confirmedSourceState(source.mdx, source.doc),
		} as ServiceInput);
		return storePort.createEntryWithReferences({
			snapshot,
			references: snapshot.references,
			folderId: source.folderId,
			publishImmediately: false,
			locale: params.locale,
			translationOf: sourceId,
		});
	},
});
