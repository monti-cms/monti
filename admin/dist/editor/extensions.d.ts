import { type EditorMarkSpec } from "./added-marks.js";
/**
 * Editor extension assembly. Feature extensions (key handling, drag, plugins) are added to this list.
 * Schema nodes go in `tiptap-schema.ts`, block nodes with dedicated edit UI in `block-views.ts`,
 * and CmsNode ↔ Tiptap conversion in `converters/`. The look of added text styles (`marks`) is provided by the admin extension (`CmsAdminComponents.marks`).
 */
export declare function buildEditorExtensions(marks?: Readonly<Record<string, EditorMarkSpec>>): (import("@tiptap/core").Extension<any, any> | import("@tiptap/core").Extension<import("@tiptap/starter-kit").StarterKitOptions, any> | import("@tiptap/core").Extension<import("@tiptap/extension-text-align").TextAlignOptions, any> | import("@tiptap/core").Mark<any, any> | import("@tiptap/core").Mark<import("@tiptap/extension-subscript").SubscriptExtensionOptions, any> | import("@tiptap/core").Node<any, any> | import("@tiptap/core").Node<import("@tiptap/extension-code-block").CodeBlockOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-table").TableCellOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-table").TableOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-list").TaskItemOptions, any> | import("@tiptap/core").Node<import("@tiptap/extension-list").TaskListOptions, any>)[];
