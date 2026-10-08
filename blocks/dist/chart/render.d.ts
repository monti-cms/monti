import type { DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { type BlockLabels } from "../shared/labels.js";
/**
 * Rendering of the chart block (` ```chart `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). If the syntax is wrong, the
 * server renders each line's error; otherwise the browser draws the chart (the source is shown until then).
 */
export declare function Chart({ source, labels }: {
    source?: string;
    labels?: BlockLabels;
}): import("react").JSX.Element;
/** Public components for the chart in the JSON renderer (`renderDocument`): the block `chart`. The code of the fence arrives as `source`. */
export declare const documentComponents: ({ locale }: DocumentComponentsContext) => LooseDocumentComponents;
