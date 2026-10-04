"use client";

import { type ComponentType, useEffect, useState } from "react";

/**
 * Chart rendering slot. On the server and before loading, shows the chart source; in the browser, loads `recharts` (optional dependency)
 * and swaps it for the chart. If loading fails, the source is left as is.
 */
export function ChartClient({ source }: { source: string }) {
	const [View, setView] = useState<ComponentType<{ source: string }> | null>(null);

	useEffect(() => {
		let disposed = false;
		import("./view")
			.then((module) => {
				if (!disposed) setView(() => module.ChartView);
			})
			.catch(() => {});
		return () => {
			disposed = true;
		};
	}, []);

	if (View) return <View source={source} />;
	return (
		<figure className="cms-block-chart" data-state="loading">
			<pre className="cms-block-chart-source">
				<code>{source}</code>
			</pre>
		</figure>
	);
}
