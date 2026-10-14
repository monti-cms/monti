/**
 * The contract between the AI plugin (`@monti-cms/ai`) and the plugins that add AI actions (`contributes: { ai: { actions } }`): the block extension's diagram
 * actions, the SEO extension's suggestions, a site's own. Types only: this module has no runtime code, so a plugin that contributes actions imports the shape from
 * here and never depends on the AI plugin, and the published type declarations of a contributing plugin do not point at it. The AI plugin implements the contract
 * (it re-exports these types, and checks its own schemas against them).
 */
export {};
