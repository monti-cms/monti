import type { Site } from "@monti-cms/core/client";
import { type EditorMarkSpec } from "./added-marks.js";
import { type EditorAllowance } from "./allowed.js";
/**
 * Editor extension assembly. Feature extensions (key handling, drag, plugins) are added to this list.
 * Schema nodes go in `tiptap-schema.ts`, core block nodes (image, file, math) in `block-views.ts`,
 * and CmsNode ↔ Tiptap conversion in `converters/`. The look of added text styles (`marks`) is provided by the admin extension (`CmsAdminComponents.marks`).
 * `allowance` is what the body's allowed list lets a writer add (`allowed.ts`); without it everything is allowed.
 */
export declare function buildEditorExtensions(site: Site, marks?: Readonly<Record<string, EditorMarkSpec>>, allowance?: EditorAllowance): import("@tiptap/core").AnyExtension[] | (import("@tiptap/core").Extension<any, any> | import("@tiptap/core").Extension<import("@tiptap/starter-kit").StarterKitOptions, any> | import("@tiptap/core").Extension<import("@tiptap/extension-text-align").TextAlignOptions, any> | import("@tiptap/core").Mark<any, any> | import("@tiptap/core").Mark<import("@tiptap/extension-subscript").SubscriptExtensionOptions, any> | import("@tiptap/core").Node<any, any> | import("@tiptap/core").Node<import("@tiptap/extension-code-block").CodeBlockOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-table").TableCellOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-table").TableOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-list").TaskItemOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-list").TaskListOptions, any>)[];
