import type { FormatRegistry } from "../../format/registry.js";
import type { Site } from "../../site/index.js";
import type { ImportSource } from "./types.js";
/** What an uploaded archive may inflate to, in all. A small archive cannot expand without limit. */
export declare const MAX_IMPORT_INFLATED_BYTES: number;
/**
 * Reads an uploaded archive by the layout this version writes, whichever of the two kinds it is:
 * - an export (it has a `manifest.json`): the entries are those the manifest lists; each is read from its `published` copy, else from its `working` copy;
 * - a folder of `.md` / `.mdx` files with front matter.
 * Nothing is written. An archive that is neither is refused, and so is a text folder whose files no installed format can read.
 */
export declare function readImportArchive(bytes: Uint8Array, options: {
    site: Pick<Site, "DEFAULT_LOCALE">;
    formats: FormatRegistry;
}): ImportSource;
/** The names of the values an entry holds besides the title, for the "fields not imported" list. A value with nothing in it is not a field the archive holds. */
export declare const heldFieldNames: (metadata: Readonly<Record<string, unknown>>, titleName: string | null) => string[];
