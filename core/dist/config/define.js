import { checkCodeBlockConfig } from "../annotation/code-block/line-effects.js";
import { createBlocks } from "../blocks/active.js";
import { resolveBlocksChecked } from "../blocks/resolve.js";
import { checkMediaConfig } from "../core/media-types.js";
import { checkPluginNames, checkPluginPages } from "../plugin/collisions.js";
import { checkBodyAllowed } from "../schema/allowed.js";
import { normalizeCollection } from "../schema/collection.js";
import { checkPlacements } from "../schema/layout.js";
import { configShapeIssues } from "../schema-file/format.js";
import { isRecord, layerSite, resolveSchemaConfig } from "../schema-file/merge.js";
import { SCHEMA_SOURCE } from "../schema-file/source.js";
import { checkCollections } from "./check/collections.js";
import { CONFIG_SOURCE, IssueList, throwIssues } from "./check/issue.js";
import { checkSite } from "./check/site.js";
/**
 * Every problem of a config, as issues. Runs the shape of the plain data first (types, enums, unknown keys), then the rules about what the values mean
 * (`check/`), then the parts other modules own: the body lists, blocks, code blocks, media and what the plugins say about the config.
 */
function checkConfig(config, alsoKnown = []) {
    const shape = configShapeIssues(config);
    if (shape.length > 0)
        return shape;
    const list = new IssueList();
    checkSite(list, config, alsoKnown);
    checkCollections(list, config.collections);
    list.addAll(checkCodeBlockConfig(config.codeBlock));
    list.addAll(checkMediaConfig(config.media));
    const { blocks: blockDefinitions, issues: blockIssues } = resolveBlocksChecked(config);
    list.addAll(blockIssues);
    if (blockIssues.length === 0) {
        // The names in a body's allowed list must be blocks and marks of this site.
        const bodySite = createBlocks(config);
        for (const [collection, schema] of Object.entries(config.collections)) {
            list.addAll(checkBodyAllowed(collection, schema.allowed, bodySite));
        }
    }
    const plugins = config.plugins ?? [];
    list.addAll(checkPluginNames(plugins.map((plugin) => plugin.name)));
    list.addAll(checkPluginPages(plugins.flatMap((plugin) => (plugin.nav ?? []).map((item) => ({ plugin: plugin.name, path: item.path })))));
    list.addAll(checkPlacements(plugins));
    const blocks = blockDefinitions.map((block) => block.name);
    for (const plugin of plugins) {
        list.addAll(plugin.validate?.({
            collections: config.collections,
            locales: config.locales,
            defaultLocale: config.defaultLocale,
            blocks,
            blockDefinitions,
            plugins,
        }));
    }
    return list.issues;
}
export function defineSite(input) {
    return buildSite(input);
}
/**
 * `defineSite` with a lowest layer under the config: `defaults.site` is what the file's and the code's `site` settings are laid over (the server's `defineConfig` passes
 * the `SITE_URL` variable this way, so the environment is the weakest source of the site URL).
 */
export function buildSite(input, defaults = {}) {
    const withSchema = "schema" in input && input.schema !== undefined;
    const config = (withSchema
        ? resolveSchemaConfig(input, defaults)
        : layerSite(input, defaults));
    // Also accepts definitions written without `defineCollection`. The core only reads the normalized `kind`.
    const collections = isRecord(config.collections)
        ? Object.fromEntries(Object.entries(config.collections).map(([name, schema]) => [name, normalizeCollection(schema)]))
        : config.collections;
    const normalized = { ...config, collections };
    throwIssues(CONFIG_SOURCE, checkConfig(normalized, defaults.alsoKnown));
    if (withSchema) {
        const schemaInput = input;
        // Hidden: lets an instance rebuild the config with another schema (see `schema-file/source.ts`).
        Object.defineProperty(normalized, SCHEMA_SOURCE, {
            value: {
                rebuild: (schema) => buildSite({ ...schemaInput, schema }, defaults),
            },
        });
    }
    return normalized;
}
