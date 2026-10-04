import { type BlockLabels, blockLabels } from "../shared/labels";
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
 * 차트 블록(` ```chart `)의 그리기. 코드는 `source` 속성이다(`remarkFenceBlocksToMdx`). 문법이 틀리면 줄마다 오류를 서버에서
 * 그리고, 맞으면 브라우저가 차트로 그린다(그 전에는 원문).
 */
export function Chart({ source, labels = blockLabels() }: { source?: string; labels?: BlockLabels }) {
	const text = source ?? "";
	const normalized = normalizeChartDsl(parseChartDsl(text));
	if (!normalized.spec) return <ChartError errors={normalized.errors} labels={labels} />;
	return <ChartClient source={text} />;
}

type ChartProps = Parameters<typeof Chart>[0];

/** 차트의 공개 컴포넌트(`@monti-cms/core/render`가 부른다). 차트는 브라우저에서 그린다(선택 의존성 `recharts`). */
export default ({ locale }: { locale?: string }) => {
	const labels = blockLabels(locale);
	return { Chart: (props: ChartProps) => <Chart {...props} labels={labels} /> };
};
