"use client";

import { type ComponentType, useEffect, useState } from "react";

/**
 * 차트 그리기 자리. 서버와 불러오기 전에는 차트 원문을 보이고, 브라우저에서 `recharts`(선택 의존성)를 불러온 뒤 차트로
 * 바꾼다. 불러오지 못하면 원문을 그대로 둔다.
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
