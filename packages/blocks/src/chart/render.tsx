import type { BlockProps, DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { type BlockLabels, blockLabels } from "../shared/labels";
import type { chartBlock } from "./definition";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { ChartClient } from "./render.client";
import type { ChartRenderError } from "./types";

function ChartError({ errors, labels }: { errors: readonly ChartRenderError[]; labels: BlockLabels }) {
	return (
		<div className="cms-block-chart-error" role="alert">
			<strong>{labels.chartError}</strong>
			<ul>
				{errors.map((error) => (
					<li key={`${error.line}-${error.code}-${JSON.stringify(error.values ?? {})}`}>
						{labels.chartErrorLine(error)}
					</li>
				))}
			</ul>
		</div>
	);
}

/**
 * Rendering of the chart block (` ```chart `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). If the syntax is wrong, the
 * server renders each line's error; otherwise the browser draws the chart (the source is shown until then).
 */
export function Chart({ source, labels = blockLabels() }: { source?: string; labels?: BlockLabels }) {
	const text = source ?? "";
	const normalized = normalizeChartDsl(parseChartDsl(text));
	if (!normalized.spec) return <ChartError errors={normalized.errors} labels={labels} />;
	return <ChartClient source={text} />;
}

/** Public components for the chart in the JSON renderer (`renderDocument`): the block `chart`. The code of the fence arrives as `source`. */
export const documentComponents = ({ locale }: DocumentComponentsContext): LooseDocumentComponents => {
	const labels = blockLabels(locale);
	return {
		blocks: { chart: ({ source }: BlockProps<typeof chartBlock>) => <Chart source={source} labels={labels} /> },
	};
};
