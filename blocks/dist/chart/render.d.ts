import { type BlockLabels } from "../shared/labels.js";
/**
 * Rendering of the chart block (` ```chart `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). If the syntax is wrong, the
 * server renders each line's error; otherwise the browser draws the chart (the source is shown until then).
 */
export declare function Chart({ source, labels }: {
    source?: string;
    labels?: BlockLabels;
}): import("react").JSX.Element;
type ChartProps = Parameters<typeof Chart>[0];
export default _default;
/** Public chart component (called by `@monti-cms/core/render`). The chart is drawn in the browser (optional dependency `recharts`). */
declare function _default({ locale }: {
    locale?: string;
}): {
    Chart: (props: ChartProps) => import("react").JSX.Element;
};
