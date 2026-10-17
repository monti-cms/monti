import { type AdminComponents } from "@monti-cms/admin";
import { type EditorMarkExtension, type MarkAttrs } from "@monti-cms/admin/editor";
/** Text color display in the editor. The same `.monti-color` rule (`styles.css`, the same as `render.css` for the public page) picks the color for the theme. */
export declare function colorMarkAttributes(attrs: MarkAttrs): Record<string, string>;
/** Editor registration of the text color mark. Text typed right after a colored run does not inherit the color. */
export declare const colorMarkExtension: EditorMarkExtension;
/** The text color mark's editor display, format tool, and bubble. */
export declare const colorComponents: AdminComponents;
