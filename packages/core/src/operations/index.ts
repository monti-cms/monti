import type { AnyOperation } from "./define";
import { checkPublishEntry, entryTranslations, entryUsages, findEntries, getEntry, listEntries } from "./read/entries";
import { getFolder, listFolders } from "./read/folders";
import { getMedia, listMedia } from "./read/media";
import { describeSite, readSchema } from "./read/site";
import { getTemplate, listTemplates } from "./read/templates";
import { moveEntriesToFolder, trashEntries, updateEntryFields } from "./write/entries";
import { trashMedia, updateMediaText } from "./write/media";

export {
	type AnyOperation,
	defineOperation,
	type Operation,
	type OperationContext,
	type OperationKind,
	type WriteApplied,
	type WritePlan,
	type WriteTarget,
} from "./define";

/** The operations of the core, in the order the agent is offered them. Plugins add theirs with `defineServerPlugin({ operations })`. */
export const CORE_OPERATIONS: readonly AnyOperation[] = [
	describeSite,
	readSchema,
	listEntries,
	findEntries,
	getEntry,
	entryUsages,
	entryTranslations,
	checkPublishEntry,
	listFolders,
	getFolder,
	listMedia,
	getMedia,
	listTemplates,
	getTemplate,
	updateEntryFields,
	moveEntriesToFolder,
	trashEntries,
	updateMediaText,
	trashMedia,
];
