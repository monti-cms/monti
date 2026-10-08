import { serviceInputKeys, validateExactRecord } from "../core/snapshot.js";
import { withTranslationHints } from "../core/translation/hints.js";
import { confirmedSourceState } from "../core/translation/state.js";
import { ServiceError, } from "./types.js";
import { createWritePipeline, linkResolverOf } from "./write-pipeline.js";
// Snapshot rules live in the domain layer (`core/snapshot`). Re-exported to keep the existing import path.
export { imageWarningsForSnapshot, prepareSnapshot, validateForPublish } from "../core/snapshot.js";
const assertInputKeys = (input, baseKeys) => {
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw new ServiceError("invalid_input");
    const withFolder = input.folderId !== undefined;
    validateExactRecord(input, withFolder ? [...baseKeys, "folderId"] : baseKeys);
};
/**
 * A record collection must be creatable by entering only a name. If the slug is empty, it is built from the value the address field's `from`
 * points to (not built if there is no `from`). An explicit save is itself a public update, so a record without a slug cannot exist.
 */
const withRecordSlug = (site, input) => {
    if (!site.isItemCollection(input.collection) || input.slug?.trim())
        return input;
    const slug = site.slugFromValues(input.collection, input.metadata ?? {});
    return slug ? { ...input, slug } : input;
};
/**
 * Content writes. Each builds its input and sends it through the one write pipeline (`write-pipeline.ts`) before the store commits it.
 * The store never prepares content itself.
 */
export const createContentService = (storePort, options) => {
    const { site } = options;
    const pipeline = options.pipeline ??
        createWritePipeline({
            hooks: options.hooks,
            formats: options.formats,
            media: options.media,
            site,
            links: linkResolverOf(site, storePort),
        });
    return {
        /**
         * Creates new content. A record collection is published right away by default (when `publishImmediately` is omitted).
         */
        createDraft: async (input, options) => {
            assertInputKeys(input, serviceInputKeys(input));
            const { folderId, ...rest } = withRecordSlug(site, input);
            const { snapshot, warnings } = await pipeline.run({
                operation: "create",
                locale: site.DEFAULT_LOCALE,
                input: rest,
            });
            const entry = await storePort.createEntryWithReferences({
                snapshot,
                references: snapshot.references,
                folderId,
                publishImmediately: options?.publishImmediately ?? site.isItemCollection(input.collection),
            });
            return { entry, warnings };
        },
        /**
         * Saves the latest draft. A record collection by default applies to the public value together with the save.
         */
        saveDraft: async (entryId, input, options) => {
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
            const { doc: previousDoc, metadata: previousMetadata, locale } = await storePort.getWorking({ entryId });
            const { snapshot, warnings } = await pipeline.run({
                operation: "save",
                entryId,
                locale: locale ?? site.DEFAULT_LOCALE,
                input: rest,
                prepare: { previousReferences, previousDoc, previousMetadata },
            });
            const entry = await storePort.saveWorkingWithReferences({
                entryId,
                expectedVersion,
                snapshot,
                references: snapshot.references,
                folderId,
                publishImmediately: options?.publishImmediately ?? site.isItemCollection(input.collection),
            });
            return { entry, warnings };
        },
        /**
         * Creates a translation. A draft whose structure follows the latest draft of the source (the source of the group), with the source text placed as translation notes.
         * The address reuses the source address (languages differ, so they do not collide). The folder is the same as the source.
         * If called on a translation, it is created from that group's source.
         */
        createTranslation: async (params) => {
            if (!site.isLocale(params.locale))
                throw new ServiceError("invalid_input");
            const picked = await storePort.getWorking({ entryId: params.sourceId });
            const sourceId = picked.translationGroupId ?? params.sourceId;
            const source = sourceId === params.sourceId ? picked : await storePort.getWorking({ entryId: sourceId });
            if (!site.isCollection(source.collection) || site.isItemCollection(source.collection)) {
                throw new ServiceError("invalid_input");
            }
            // A translation starts from the source skeleton. Structure (headings, paragraphs, boxes, lists, tables), code and images are kept, and text
            // becomes translation notes (faded source text). Per-language values such as title and summary are emptied (the edit screen shows the source title as a placeholder).
            // The translation state records the current source (its MDX and document) as the "confirmed source". If the source changes, the translation screen tells you.
            const { snapshot, warnings } = await pipeline.run({
                operation: "translate",
                locale: params.locale,
                input: {
                    collection: source.collection,
                    slug: source.slug,
                    metadata: {},
                    doc: withTranslationHints(site, source.doc),
                    translation: confirmedSourceState(source.doc),
                },
            });
            const entry = await storePort.createEntryWithReferences({
                snapshot,
                references: snapshot.references,
                folderId: source.folderId,
                publishImmediately: false,
                locale: params.locale,
                translationOf: sourceId,
            });
            return { entry, warnings };
        },
        /**
         * Duplicates the latest draft as a new draft: same body and fields, in the original's locale and folder. Slug, publish status and the
         * published version are not copied. `title` replaces the copy's title; any suffix (such as "(copy)") is up to the caller.
         * A record or a translation cannot be duplicated (translate the source instead).
         */
        duplicate: async (params) => {
            const source = await storePort.getWorking({ entryId: params.id });
            if (site.isItemCollection(source.collection))
                throw new ServiceError("invalid_input");
            if (source.translationGroupId !== undefined && source.translationGroupId !== params.id) {
                throw new ServiceError("invalid_input");
            }
            const metadata = params.title === undefined
                ? source.metadata
                : { ...source.metadata, [site.titleField(source.collection).name]: params.title };
            const { snapshot, warnings } = await pipeline.run({
                operation: "duplicate",
                locale: source.locale ?? site.DEFAULT_LOCALE,
                input: { collection: source.collection, slug: null, metadata, doc: source.doc },
                // The copy is a new entry, but the values of fields the schema no longer has go with it, as they do in the original.
                prepare: { previousDoc: source.doc, previousMetadata: source.metadata },
            });
            const entry = await storePort.createEntryWithReferences({
                snapshot,
                references: snapshot.references,
                folderId: source.folderId,
                publishImmediately: false,
                locale: source.locale,
            });
            return { entry, warnings };
        },
        /**
         * Publishes the latest saved draft. The draft goes through the write pipeline first (a hook that changed it has the change saved with the
         * publish, in one transaction), then the store checks the prepared draft against the rows it has to lock and commits.
         * `extraWarnings` adds notices computed from the prepared draft (image state), which never block.
         */
        publish: async (params, options) => {
            const previousReferences = await storePort.getWorkingReferences({ entryId: params.id });
            const working = await storePort.getWorking({ entryId: params.id });
            const { snapshot, warnings, transformed } = await pipeline.run({
                operation: "publish",
                entryId: params.id,
                locale: working.locale ?? site.DEFAULT_LOCALE,
                input: {
                    collection: working.collection,
                    slug: working.slug,
                    metadata: working.metadata,
                    doc: working.doc,
                },
                prepare: { previousReferences, previousDoc: working.doc, previousMetadata: working.metadata },
            });
            const noticed = options?.extraWarnings ? await options.extraWarnings(snapshot) : (snapshot.warnings ?? []);
            // Notices found while the targets are locked (a link to an entry that is not published) join the ones found before the transaction.
            const locked = [];
            const onWarnings = (found) => locked.push(...found);
            const entry = transformed
                ? await storePort.saveWorkingWithReferences({
                    entryId: params.id,
                    expectedVersion: params.expectedVersion,
                    snapshot,
                    references: snapshot.references,
                    publishImmediately: true,
                    resetPublishedAt: params.resetPublishedAt,
                    publishedAt: params.publishedAt,
                    onWarnings,
                })
                : (await storePort.publishEntry({
                    id: params.id,
                    expectedVersion: params.expectedVersion,
                    snapshot,
                    resetPublishedAt: params.resetPublishedAt,
                    publishedAt: params.publishedAt,
                    onWarnings,
                }));
            return { entry, warnings: [...noticed, ...locked, ...warnings] };
        },
        /**
         * Trash to restore. A record is published again, so its draft goes through the write pipeline first as a `restore`: `validate` and
         * `validatePublish` hooks run (a restriction on publishing cannot be bypassed by trash and restore), `transform` hooks do not (the content
         * is unchanged). Other collections return to draft and are not published, so nothing runs for them.
         */
        restore: async (params) => {
            if (!storePort.restoreEntry)
                throw new Error("content service: the store cannot restore entries");
            const working = await storePort.getWorking({ entryId: params.id });
            if (!site.isItemCollection(working.collection)) {
                const entry = await storePort.restoreEntry({ id: params.id, expectedVersion: params.expectedVersion });
                return { entry, warnings: [] };
            }
            const previousReferences = await storePort.getWorkingReferences({ entryId: params.id });
            const { snapshot, warnings } = await pipeline.run({
                operation: "restore",
                entryId: params.id,
                locale: working.locale ?? site.DEFAULT_LOCALE,
                input: {
                    collection: working.collection,
                    slug: working.slug,
                    metadata: working.metadata,
                    doc: working.doc,
                },
                prepare: { previousReferences, previousDoc: working.doc, previousMetadata: working.metadata },
                skipTransform: true,
            });
            const entry = await storePort.restoreEntry({ id: params.id, expectedVersion: params.expectedVersion, snapshot });
            return { entry, warnings };
        },
    };
};
