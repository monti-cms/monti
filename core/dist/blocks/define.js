/**
 * Body block definition spec. Defines one block's storage syntax, settings attributes, child rules, editing mode, and public renderer in one place.
 *
 * Definitions are shared by the server (storage validation), the editor, the public renderer, and `/meta`, so they hold **only JSON-serializable values**.
 * Editing UI (NodeView, settings form) and public components are referenced by name only; implementations live in their own registries:
 *
 * - Public renderer: the site's MDX component table (`component` name)
 * - Editor: core blocks (image, file, math) use the admin package's `editor/block-views.ts` (`editor.nodeView` name). For added blocks,
 *   the admin package builds editor nodes from the definition, and the edit screen takes `blockViews` (whole view) or
 *   `blockEditors` (attribute and body boxes) from `CmsAdminComponentsProvider`. If neither exists, the default box is used.
 *
 * Sites add blocks through `blocks` in the config, and block extensions (e.g. `@monti-cms/blocks`) add them through a plugin's `blocks` (`blocks/resolve.ts`).
 */
export const defineBlock = (definition) => definition;
