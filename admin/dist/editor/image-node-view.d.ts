import type React from "react";
/** Width input: 1 to 100%, or a positive integer px of at most 4096. Empty means fit to the body. */
export declare const isValidImageWidth: (value: string) => boolean;
/** Edit view of the core image block (`blockViews.image`). */
export declare function ImageBlockView(): React.JSX.Element;
