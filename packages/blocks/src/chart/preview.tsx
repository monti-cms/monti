"use client";

import { useTranslator } from "@monti-cms/admin";
import { Banner, cn, FormFieldError } from "@monti-cms/admin/kit";
import { useMemo } from "react";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { chartErrorLine } from "./errors";
import { chartMessages } from "./messages";
import type { ChartRenderError } from "./types";
import { ChartFigure } from "./view";

/**
 * Default editor preview for the chart block. Draws the chart syntax (`./dsl`) with the public page's default chart (`./view`), so the editor
 * shows the chart as the default site draws it. Loaded only when the chart block extension's admin provider opens a preview via
 * `fencePreviews.chart`. A site that draws its own chart can replace it by registering its own renderer under the same name.
 */

function ChartErrorCard({ errors }: { errors: ChartRenderError[] }) {
	const t = useTranslator(chartMessages);
	return (
		<div className="not-prose my-monti-24 flex flex-col gap-monti-8">
			<Banner tone="danger" title={t("error.title")} />
			<FormFieldError errors={errors.map((error) => ({ message: chartErrorLine(error, t) }))} />
		</div>
	);
}

/** Draws the chart source (`source`). On a syntax error, reports each line. */
export function ChartPreview({ source, className }: { readonly source: string; readonly className?: string }) {
	const normalized = useMemo(() => normalizeChartDsl(parseChartDsl(source)), [source]);
	if (!normalized.spec) return <ChartErrorCard errors={normalized.errors} />;
	return (
		<div className={cn("not-prose", className)}>
			<ChartFigure spec={normalized.spec} />
		</div>
	);
}
