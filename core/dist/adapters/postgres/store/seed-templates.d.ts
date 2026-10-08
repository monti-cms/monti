import type { SeedTemplate } from "../../../config/define.js";
import { type StoredDocument } from "../../../doc/stored-document.js";
import type { FormatRegistry } from "../../../format/registry.js";
import type { Site } from "../../../site/index.js";
/**
 * The document a seed template of the site config is stored as. A template given as a document is checked like any stored document; one given as text
 * is read by its format, which must be one of the instance's formats (a plugin provides it). A seed that cannot become a document is a mistake in the
 * config, so it stops the migration with a message that names the template (unlike stored data, which always migrates).
 */
export declare function seedTemplateDocument(site: Site, template: SeedTemplate, formats: FormatRegistry): Promise<StoredDocument>;
