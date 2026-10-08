/** The lookup of one CMS instance (any object with its `store()` will do). */
export function createContentLookup(cms) {
    return { slugsInUse: (params) => cms.store().slugsInUse(params) };
}
