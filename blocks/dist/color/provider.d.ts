import { type EditorMarkExtension, type MarkAttrs } from "@monti-cms/admin/editor";
import type { ReactNode } from "react";
/** Text color display in the editor. The same `.cms-color` rule (`styles.css`, the same as `render.css` for the public page) picks the color for the theme. */
export declare function colorMarkAttributes(attrs: MarkAttrs): Record<string, string>;
/** Editor registration of the text color mark. Text typed right after a colored run does not inherit the color. */
export declare const colorMarkExtension: EditorMarkExtension;
/** Registers the text color mark's editor display, format tool, and bubble in the admin UI. */
export declare function ColorProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
