"use client";

import { cn } from "@monti-cms/admin/kit";
import { type RefObject, useEffect, useRef, useState } from "react";
import { drawMermaid } from "./draw";

/**
 * Default editor preview of the Mermaid block (optional dependency `mermaid`). The Mermaid block extension's admin provider registers it as `fencePreviews.mermaid`,
 * and it is loaded only when a preview is opened. A site can replace it by registering its own renderer under the same name.
 * The theme follows the `dark` class on the document (`html`) and is redrawn when it changes.
 */

const isDark = (element: Element | null) =>
	Boolean(element?.closest(".dark")) || document.documentElement.classList.contains("dark");

/** Whether the document uses the dark theme. Re-read when the class on `html` changes. */
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
				const svg = await drawMermaid(mermaid, `cms-mermaid-${renderCount}`, source);
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
