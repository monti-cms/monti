/**
 * Plugin storage: the small namespaced store a plugin keeps its own data in (settings, per-entry sync state, cached results), instead of its own
 * database tables. The instance hands each plugin one, already scoped to the plugin's name: `cms.storage("my-plugin")`. Whatever the database
 * behind the instance is, the plugin sees documents grouped in named collections, and no database driver.
 *
 * ```ts
 * const settings = cms.storage("my-plugin").collection<{ endpoint: string }>("settings");
 * const saved = await settings.set("default", { endpoint: "https://…" }, { expectedVersion: 0 }); // create
 * await settings.set("default", { endpoint: "https://…/v2" }, { expectedVersion: saved.version }); // replace
 * ```
 *
 * Values are JSON: they are stored as JSON and come back as parsed JSON, so a `Date` or `undefined` inside a value does not survive.
 */
export {};
