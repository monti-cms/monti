import { ADMIN_LANGUAGE, BLOCKS, cmsConfig, getPluginOptions } from "@monti-cms/core/client";
import { setMessageContext } from "./i18n.js";
import { AI_PLUGIN_NAME } from "./plugin-name.js";
import { resolveAiActions } from "./resolve.js";
/** Config of the AI plugin registered in the site config. `undefined` if not registered. */
// A config without the plugin has an empty tuple type, so it is read widened.
const plugins = cmsConfig.plugins ?? [];
const aiConfig = getPluginOptions(AI_PLUGIN_NAME);
// Modules read by the config file (presets, validators) cannot read the config, so the UI language is received here. Set it before resolving actions.
setMessageContext({ language: ADMIN_LANGUAGE, overrides: cmsConfig.admin?.messages });
/** Actions to run (default actions + actions added by other plugins + actions in the config, `resolveAiActions`). */
export const AI_ACTIONS = aiConfig
    ? resolveAiActions(aiConfig, { collections: cmsConfig.collections, blocks: BLOCKS, locales: cmsConfig.locales }, plugins)
    : {};
/** Shared text definitions (defaults). Values edited in the admin screen are applied by the server. */
export const AI_SHARED = aiConfig?.shared ?? {};
export const AI_SHARED_KEYS = Object.keys(AI_SHARED);
/** Site description that goes into the instruction at the start of every action. */
export const AI_SITE_DESCRIPTION = aiConfig?.siteDescription?.trim() || "website";
export const actionDefinition = (key) => Object.hasOwn(AI_ACTIONS, key) ? AI_ACTIONS[key] : undefined;
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
