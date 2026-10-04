import { type Ref } from "react";
/** Read-only MDX preview. Rendered the same as the post. Recreates the editor when the content changes. */
export declare function MdxPreview({ mdx, label }: {
    mdx: string;
    label?: string;
}): import("react").JSX.Element;
/** The full source placed beside the translation. Scrolls separately from the translation editor. */
export declare function SourcePane({ mdx, locale, title, onClose, className, ref, }: {
    mdx: string;
    locale: string;
    /** Source title. Shown large above the body, matching the title slot of the translation editor. */
    title: string;
    onClose: () => void;
    className?: string;
    /** The scrolling element. Used to link scrolling with the editor. */
    ref?: Ref<HTMLElement>;
}): import("react").JSX.Element;
