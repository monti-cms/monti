/**
 * The host side of an instance (`CmsHost`): what the framework integration, the admin UI and the command line need beyond the public `Cms`. Every instance
 * `createCms` (and so `defineConfig`) makes has it, so this only changes the type. Internal to the Monti packages.
 */
export const hostOf = (cms) => cms;
