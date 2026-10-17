import { defineBlockPlugin } from "../shared/define-block-plugin.js";
import { calloutBlock } from "./definition.js";
/**
 * Callout block (`:::callout`). A box that highlights content such as notes and warnings. Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [callout()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export const callout = () => defineBlockPlugin({
    name: "callout",
    blocks: [calloutBlock],
    admin: () => import("@monti-cms/blocks/callout/admin"),
    render: () => import("@monti-cms/blocks/callout/render"),
});
