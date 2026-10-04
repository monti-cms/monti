import { type EditorMarkExtension } from "@monti-cms/admin/editor";
import type { ReactNode } from "react";
/** Editor mark name (`cmsCodeRef`). */
export declare const CODE_REF_MARK: string;
/** Editor registration of the code-ref mark. Shown with an underline in the theme accent color. */
export declare const codeRefMarkExtension: EditorMarkExtension;
/** Registers the code-ref mark's editor display and bubble in the admin UI. */
export declare function CodeRefProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
