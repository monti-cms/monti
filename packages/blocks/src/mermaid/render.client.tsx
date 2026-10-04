"use client";

import { useEffect, useId, useRef, useState } from "react";

/** 문서가 어두운 테마인지(`html`의 `dark` 클래스·`data-theme="dark"`, 없으면 시스템 설정). */
const isDarkDocument = () => {
	const root = document.documentElement;
	if (root.classList.contains("dark") || root.dataset.theme === "dark") return true;
	if (root.classList.contains("light") || root.dataset.theme === "light") return false;
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};

/** 문서의 어두운 테마 여부. 테마가 바뀌면 다시 읽는다. */
function useDarkTheme() {
	const [dark, setDark] = useState(false);
	useEffect(() => {
		const read = () => setDark(isDarkDocument());
		read();
		const observer = new MutationObserver(read);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
		return () => observer.disconnect();
	}, []);
	return dark;
}

type State = { readonly svg: string } | { readonly error: string } | null;

/**
 * Mermaid 다이어그램(` ```mermaid `). 서버와 불러오기 전에는 원문을 보이고, 브라우저에서 `mermaid`(선택 의존성)를 불러와
 * 다이어그램으로 바꾼다. 불러오지 못하거나 문법이 틀리면 원문과 오류 글을 그대로 둔다. 테마가 바뀌면 다시 그린다.
 */
export function MermaidView({ source }: { source: string }) {
	const baseId = useId().replace(/[^\w-]/g, "");
	const counter = useRef(0);
	const dark = useDarkTheme();
	const [state, setState] = useState<State>(null);

	useEffect(() => {
		if (!source.trim()) return;
		let disposed = false;
		(async () => {
			try {
				const { default: mermaid } = await import("mermaid");
				mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
				counter.current += 1;
				const { svg } = await mermaid.render(`cms-mermaid-${baseId}-${counter.current}`, source);
				if (!disposed) setState({ svg });
			} catch (error) {
				if (!disposed) setState({ error: error instanceof Error ? error.message : "Mermaid render error" });
			}
		})();
		return () => {
			disposed = true;
		};
	}, [source, dark, baseId]);

	const svg = state && "svg" in state ? state.svg : null;
	const error = state && "error" in state ? state.error : null;
	return (
		<figure className="cms-block-mermaid" data-state={svg ? "ready" : error ? "error" : "loading"}>
			{svg ? (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid가 `securityLevel: "strict"`로 걸러 낸 SVG다
				<div className="cms-block-mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
			) : (
				<pre className="cms-block-mermaid-source">
					<code>{source}</code>
				</pre>
			)}
			{error ? <figcaption className="cms-block-mermaid-error">{error}</figcaption> : null}
		</figure>
	);
}
