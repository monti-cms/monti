import { AI_PLUGIN_NAME } from "./plugin-name.js";
import { resolveAiActions } from "./resolve.js";
const registries = new WeakMap();
/** What a function that creates actions (`AiActionFactory`) sees of a site, apart from the shared texts. */
export const aiSiteViewOf = (site) => ({
    // The schemas of the site: their labels are read in the admin language when the site is created.
    collections: Object.fromEntries(site.COLLECTIONS.map((name) => [name, site.schemaOf(name)])),
    blocks: site.BLOCKS,
    locales: site.config.locales,
    createTranslator: site.createTranslator,
});
function createRegistry(site) {
    const aiConfig = site.getPluginOptions(AI_PLUGIN_NAME);
    // Functions of the config (factories, checks) reach a site made from the browser snapshot as nothing: an action that only a function defines is missing there, and a
    // definition keeps its data (attach points, inputs, labels, check names). The server resolves from the real config.
    const actions = aiConfig
        ? resolveAiActions(aiConfig, aiSiteViewOf(site), site.plugins)
        : {};
    const shared = aiConfig?.shared ?? {};
    return {
        actions,
        shared,
        sharedKeys: Object.keys(shared),
        siteDescription: aiConfig?.siteDescription?.trim() || "website",
        actionDefinition: (key) => (Object.hasOwn(actions, key) ? actions[key] : undefined),
    };
}
/** The AI registry of a site. Built once per site and kept as long as the site lives. */
export function aiRegistryOf(site) {
    let registry = registries.get(site);
    if (!registry) {
        registry = createRegistry(site);
        registries.set(site, registry);
    }
    return registry;
}
/** Whether the action is attached to the slot. */
export function attachedTo(attach, place) {
    if (attach.slot !== place.slot)
        return false;
    switch (attach.slot) {
        case "field":
            return (attach.field === place.target &&
                (!attach.collections || (place.collection !== undefined && attach.collections.includes(place.collection))));
        case "translation":
        case "selection":
        case "insert":
            return true;
        case "block":
            return attach.block === place.target;
        default:
            return attach.target === place.target;
    }
}
