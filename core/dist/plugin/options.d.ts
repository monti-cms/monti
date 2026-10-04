/**
 * Config values (`options`) of a plugin picked by name from `plugins` in the site config (`cms.config.ts`). Used by both server and browser code.
 * This is the official way for an extension to read its own config. `undefined` if that plugin is not in the config.
 */
export declare function getPluginOptions<Options = unknown>(name: string): Options | undefined;
