"use client";

import { useEffect, useId, useRef, useState } from "react";
import { drawMermaid } from "./draw";
import { lookKey, mermaidLook } from "./look";

/** Whether the document is in the dark theme (the `dark` class or `data-theme="dark"` on `html`, else the system setting). */
const isDarkDocument = () => {
	const root = document.documentElement;
	if (root.classList.contains("dark") || root.dataset.theme === "dark") return true;
	if (root.classList.contains("light") || root.dataset.theme === "light") return false;
	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};

/**
 * What the diagram is drawn from, as one word that changes when it does: the document's theme, the page's text colour, ground and font. Read again when the
 * `class`, `data-theme` or `style` of `html` or `body` change (a site's own theme switch) and when the system's colour setting does.
 */
function useLook(figure: React.RefObject<HTMLElement | null>) {
	const [key, setKey] = useState("");
	useEffect(() => {
		const read = () => setKey(figure.current ? lookKey(figure.current, isDarkDocument()) : "");
		read();
		const observer = new MutationObserver(read);
		const options = { attributes: true, attributeFilter: ["class", "data-theme", "style"] };
		observer.observe(document.documentElement, options);
		observer.observe(document.body, options);
		const media = window.matchMedia?.("(prefers-color-scheme: dark)");
		media?.addEventListener("change", read);
		return () => {
			observer.disconnect();
			media?.removeEventListener("change", read);
		};
	}, [figure]);
	return key;
}

/** One diagram at a time: Mermaid keeps one configuration, so `initialize`, `parse` and `render` of a diagram are not shared with another's. */
let queue: Promise<unknown> = Promise.resolve();
const alone = <T,>(job: () => Promise<T>): Promise<T> => {
	const run = queue.then(job, job);
	queue = run.catch(() => undefined);
	return run;
};

type State = { readonly svg: string | null; readonly error: string | null } | null;

/**
 * Mermaid diagram (` ```mermaid `). On the server and before loading it shows the source, then loads `mermaid` (optional dependency) in the browser and
 * turns it into a diagram with the page's own colours and font (`mermaidLook`). If loading fails or the syntax is wrong, the source stays as it is; the
 * reason goes to the editor (`onError`), never to a reader. Redrawn when the theme changes.
 */
export function MermaidView({
	source,
	lang,
	onError,
}: {
	source: string;
	/** The source's language, when the diagram keeps the source's words in a translation. */
	lang?: string;
	/** In the editor: the reason the source does not read (or `null`), said under its field; the last drawing stays meanwhile (the old block's). */
	onError?: (error: string | null) => void;
}) {
	const baseId = useId().replace(/[^\w-]/g, "");
	const counter = useRef(0);
	const figure = useRef<HTMLElement>(null);
	const look = useLook(figure);
	const [state, setState] = useState<State>(null);

	useEffect(() => {
		// Drawn once the page's look has been read (the first effect of this component sets it).
		if (!source.trim() || look === "") return;
		let disposed = false;
		(async () => {
			try {
				const { default: mermaid } = await import("mermaid");
				const svg = await alone(async () => {
					mermaid.initialize({
						startOnLoad: false,
						securityLevel: "strict",
						...(figure.current ? mermaidLook(figure.current, isDarkDocument()) : { theme: "base" as const }),
					});
					counter.current += 1;
					return drawMermaid(mermaid, `cms-mermaid-${baseId}-${counter.current}`, source);
				});
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
	}, [source, look, baseId, onError]);

	const svg = state?.svg ?? null;
	const error = state?.error ?? null;
	return (
		<figure
			ref={figure}
			className="monti-block-mermaid"
			lang={lang}
			data-state={svg ? "ready" : error ? "error" : "loading"}
		>
			{svg ? (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: SVG sanitized by mermaid with `securityLevel: "strict"`
				<div className="monti-block-mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
			) : (
				<pre className="monti-block-mermaid-source">
					<code>{source}</code>
				</pre>
			)}
		</figure>
	);
}
