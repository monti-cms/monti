"use client";

import { cn } from "@monti-cms/admin/kit";
import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Mermaid 블록의 기본 편집기 미리보기(선택 의존성 `mermaid`). Mermaid 블록 확장의 관리자 공급자가 `fencePreviews.mermaid`로
 * 미리보기를 열 때만 불러온다. 사이트는 같은 이름으로 자기 렌더러를 넣어 바꿀 수 있다.
 * 테마는 문서(`html`)의 `dark` 클래스를 따르고, 바뀌면 다시 그린다.
 */

const isDark = (element: Element | null) =>
	Boolean(element?.closest(".dark")) || document.documentElement.classList.contains("dark");

/** 문서의 어두운 테마 여부. `html`의 클래스가 바뀌면 다시 읽는다. */
function useDarkTheme(ref: RefObject<HTMLElement | null>) {
	const [dark, setDark] = useState(false);
	useEffect(() => {
		const read = () => setDark(isDark(ref.current));
		read();
		const observer = new MutationObserver(read);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, [ref]);
	return dark;
}

let renderCount = 0;

export function MermaidPreview({ source, className }: { readonly source: string; readonly className?: string }) {
	const wrapper = useRef<HTMLDivElement>(null);
	const target = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);
	const dark = useDarkTheme(wrapper);

	useEffect(() => {
		if (!source.trim()) return;
		let disposed = false;
		import("mermaid")
			.then(async ({ default: mermaid }) => {
				mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
				renderCount += 1;
				const { svg } = await mermaid.render(`cms-mermaid-${renderCount}`, source);
				if (disposed || !target.current) return;
				target.current.innerHTML = svg;
				setError(null);
			})
			.catch((reason: unknown) => {
				if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
			});
		return () => {
			disposed = true;
		};
	}, [source, dark]);

	return (
		<div ref={wrapper} className={cn("flex justify-center overflow-x-auto p-4", className)} data-error={!!error}>
			<div ref={target} className="flex w-full justify-center [&_svg]:h-auto [&_svg]:max-w-full" />
			{error && <span className="text-sm">ERROR : {error}</span>}
		</div>
	);
}
