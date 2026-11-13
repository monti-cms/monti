"use client";

import { useEffect, useId, useRef, useState } from "react";
import { drawMermaid } from "./draw";

/** Whether the document is in the dark theme (the `dark` class or `data-theme="dark"` on `html`, else the system setting). */
const isDarkDocument = () => {
	const root = document.documentElement;
	if (root.classList.contains("dark") || root.dataset.theme === "dark") return true;
	if (root.classList.contains("light") || root.dataset.theme === "light") return false;
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};

/** Whether the document uses the dark theme. Re-read when the theme changes. */
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

type State = { readonly svg: string | null; readonly error: string | null } | null;

/**
 * Mermaid diagram (` ```mermaid `). On the server and before loading it shows the source, then loads `mermaid` (optional dependency) in the browser and
 * turns it into a diagram. If loading fails or the syntax is wrong, the source and the error text stay as they are. Redrawn when the theme changes.
 */
export function MermaidView({
	source,
	onError,
}: {
	source: string;
	/** In the editor: the reason the source does not read (or `null`), said under its field; the last drawing stays meanwhile (the old block's). */
	onError?: (error: string | null) => void;
}) {
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
				const svg = await drawMermaid(mermaid, `cms-mermaid-${baseId}-${counter.current}`, source);
				if (!disposed) {
					setState({ svg, error: null });
					onError?.(null);
				}
			} catch (error) {
				const reason = error instanceof Error ? error.message : "Mermaid render error";
				if (!disposed) {
					setState((before) => ({ svg: onError ? (before?.svg ?? null) : null, error: reason }));
					onError?.(reason);
				}
			}
		})();
		return () => {
			disposed = true;
		};
	}, [source, dark, baseId, onError]);

	const svg = state?.svg ?? null;
	const error = onError ? null : (state?.error ?? null);
	return (
		<figure className="monti-block-mermaid" data-state={svg ? "ready" : error ? "error" : "loading"}>
			{svg ? (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: SVG sanitized by mermaid with `securityLevel: "strict"`
				<div className="monti-block-mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
			) : (
				<pre className="monti-block-mermaid-source">
					<code>{source}</code>
				</pre>
			)}
			{error ? <figcaption className="monti-block-mermaid-error">{error}</figcaption> : null}
		</figure>
	);
}
