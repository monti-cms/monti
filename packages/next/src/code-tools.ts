/**
 * What a reader presses in the code blocks `renderDocument` draws (doc 17), as the old code block did: the copy button, folded words, and code links.
 * Plain DOM, so a site that is not React calls it too; `CodeTools` is the React way. Returns a function that takes it all off again.
 */

/** The words it writes itself, in the site's language. */
export type CodeToolsLabels = { back: string };

/** How long a pressed copy button says so, and a pressed code link keeps its lines lit (ms). */
const COPIED_FOR = 2000;
const LIT_FOR = 1600;
/** The most lines a link's preview shows when its lines are off screen. */
const PREVIEW_LINES = 8;

const linesOf = (root: ParentNode, link: Element) => {
	const [block, anchor] = (link.getAttribute("data-code-ref") ?? "").split(" ");
	const figure = root.querySelector(`figure[data-code][data-block="${CSS.escape(block ?? "")}"]`);
	const lines = figure
		? [...figure.querySelectorAll(".line[data-anchor]")].filter((line) =>
				(line.getAttribute("data-anchor") ?? "").split(" ").includes(anchor ?? ""),
			)
		: [];
	return { figure, lines };
};

/** The code's text without what the page added to it (the `…` of folded words). */
function codeText(figure: Element): string {
	const code = figure.querySelector("pre > code");
	if (!code) return "";
	const copy = code.cloneNode(true) as Element;
	for (const added of copy.querySelectorAll("[data-code-ui]")) added.remove();
	return copy.textContent ?? "";
}

const onScreen = (element: Element) => {
	const box = element.getBoundingClientRect();
	return box.bottom > 0 && box.top < window.innerHeight;
};

export function attachCodeTools(
	root: Document | HTMLElement = document,
	labels: CodeToolsLabels = { back: "Back to the text" },
): () => void {
	const doc = root instanceof Document ? root : root.ownerDocument;
	let preview: HTMLElement | null = null;
	let lit: { figure: Element | null; lines: Element[]; link: Element } | null = null;
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const later = (run: () => void, ms: number) => {
		const timer = setTimeout(() => {
			timers.delete(timer);
			run();
		}, ms);
		timers.add(timer);
	};

	const unlight = () => {
		if (!lit) return;
		lit.figure?.removeAttribute("data-lit");
		for (const line of lit.lines) line.removeAttribute("data-lit");
		lit.link.removeAttribute("data-lit");
		lit = null;
		preview?.remove();
		preview = null;
	};
	const light = (link: Element, withPreview: boolean) => {
		unlight();
		const { figure, lines } = linesOf(root, link);
		if (!figure || lines.length === 0) return;
		figure.setAttribute("data-lit", "");
		for (const line of lines) line.setAttribute("data-lit", "");
		link.setAttribute("data-lit", "");
		lit = { figure, lines, link };
		// Lines the reader cannot see are shown beside the words.
		if (withPreview && !lines.some(onScreen)) {
			preview = doc.createElement("div");
			preview.setAttribute("data-code-preview", "");
			preview.setAttribute("role", "tooltip");
			const shown = lines.slice(0, PREVIEW_LINES).map((line) => {
				const copy = line.cloneNode(true) as Element;
				for (const added of copy.querySelectorAll("[data-code-ui], [data-code-back]")) added.remove();
				return copy.textContent ?? "";
			});
			preview.textContent = lines.length > PREVIEW_LINES ? [...shown, "…"].join("\n") : shown.join("\n");
			const box = link.getBoundingClientRect();
			preview.style.left = `${box.left + window.scrollX}px`;
			preview.style.top = `${box.bottom + window.scrollY + 4}px`;
			doc.body.append(preview);
		}
	};

	/** The first words that point at a label get a button at the end of its first line that goes back to them. */
	const backs: Element[] = [];
	const seen = new Set<string>();
	for (const link of root.querySelectorAll("a[data-code-ref]")) {
		const ref = link.getAttribute("data-code-ref") ?? "";
		if (seen.has(ref)) continue;
		seen.add(ref);
		const [first] = linesOf(root, link).lines;
		if (!first) continue;
		const button = doc.createElement("button");
		button.type = "button";
		button.setAttribute("data-code-back", "");
		button.setAttribute("data-code-ui", "");
		button.setAttribute("aria-label", labels.back);
		button.textContent = "↩";
		button.addEventListener("click", () => {
			link.scrollIntoView({ block: "center", behavior: "smooth" });
			(link as HTMLElement).focus({ preventScroll: true });
			light(link, false);
			later(unlight, LIT_FOR);
		});
		first.append(button);
		backs.push(button);
	}

	const onClick = (event: Event) => {
		const target = event.target as Element | null;
		const copy = target?.closest("[data-code-copy]");
		if (copy) {
			const figure = copy.closest("figure[data-code]");
			if (!figure) return;
			const words = copy.textContent;
			void navigator.clipboard?.writeText(codeText(figure)).then(() => {
				copy.textContent = copy.getAttribute("data-copied") ?? words;
				later(() => {
					copy.textContent = words;
				}, COPIED_FOR);
			});
			return;
		}
		const fold = target?.closest("[data-code-fold] > button");
		if (fold) {
			fold.parentElement?.setAttribute("data-open", "");
			return;
		}
		const link = target?.closest("a[data-code-ref]");
		if (link) {
			event.preventDefault();
			const { lines } = linesOf(root, link);
			if (lines.length === 0) return;
			// Folded lines open so the line can be seen.
			for (const line of lines)
				for (let up = line.closest("details"); up; up = up.parentElement?.closest("details") ?? null) up.open = true;
			lines[0].scrollIntoView({ block: "center", behavior: "smooth" });
			light(link, false);
			later(unlight, LIT_FOR);
		}
	};
	const onOver = (event: Event) => {
		const link = (event.target as Element | null)?.closest("a[data-code-ref]");
		if (link && lit?.link !== link) light(link, true);
	};
	const onOut = (event: Event) => {
		const link = (event.target as Element | null)?.closest("a[data-code-ref]");
		const into = (event as FocusEvent).relatedTarget as Element | null;
		if (link && !link.contains(into)) unlight();
	};
	const onKey = (event: Event) => {
		if ((event as KeyboardEvent).key === "Escape") unlight();
	};
	root.addEventListener("click", onClick);
	root.addEventListener("pointerover", onOver);
	root.addEventListener("pointerout", onOut);
	root.addEventListener("focusin", onOver);
	root.addEventListener("focusout", onOut);
	doc.addEventListener("keydown", onKey);
	return () => {
		root.removeEventListener("click", onClick);
		root.removeEventListener("pointerover", onOver);
		root.removeEventListener("pointerout", onOut);
		root.removeEventListener("focusin", onOver);
		root.removeEventListener("focusout", onOut);
		doc.removeEventListener("keydown", onKey);
		for (const timer of timers) clearTimeout(timer);
		for (const button of backs) button.remove();
		unlight();
	};
}
