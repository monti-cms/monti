import type { Page } from "@playwright/test";

/** One thing a check found: which check, and where on the page. */
export interface Finding {
	readonly check: "overflow" | "clipped" | "type";
	readonly detail: string;
}

/**
 * The automated checks, run on the page of every shot (the same story, the same theme):
 * - overflow: the page scrolls sideways;
 * - clipped: an element hides part of its own text (`overflow: hidden` or `clip`, more content than room) without a `text-overflow: ellipsis` or a
 *   line clamp that says the cut is meant;
 * - type: an element that carries a `text-monti-<role>` type class does not compute to that role's font size. Line height and weight are left out: a part sets
 *   them on purpose (`leading-none` in a badge, `font-semibold` in a button). An element whose role changes under a variant is left out too.
 * The function runs in the page, so it holds no outside reference.
 */
export const runPageChecks = (page: Page): Promise<Finding[]> =>
	page.evaluate(() => {
		const findings: { check: "overflow" | "clipped" | "type"; detail: string }[] = [];
		const describe = (el: Element) => {
			const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
			const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
			return `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}> "${text}"`;
		};

		const root = document.documentElement;
		if (root.scrollWidth > root.clientWidth)
			findings.push({
				check: "overflow",
				detail: `page is ${root.scrollWidth}px wide in a ${root.clientWidth}px window`,
			});

		const hides = (value: string) => value === "hidden" || value === "clip";
		for (const el of document.body.querySelectorAll("*")) {
			const style = getComputedStyle(el);
			if (!hides(style.overflowX) && !hides(style.overflowY)) continue;
			const box = el.getBoundingClientRect();
			// A visually hidden element (a screen-reader label) is cut on purpose, and so is one that is not shown.
			if (box.width <= 1 || box.height <= 1 || style.visibility === "hidden" || style.display === "none") continue;
			if (!(el.textContent ?? "").trim()) continue;
			// The cut is meant: an ellipsis at the end of the line, or a line clamp.
			if (style.textOverflow === "ellipsis" || style.getPropertyValue("-webkit-line-clamp") !== "none") continue;
			const sideways = hides(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
			const down = hides(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
			if (sideways || down)
				findings.push({
					check: "clipped",
					detail: `${describe(el)} content ${el.scrollWidth}x${el.scrollHeight} in a ${el.clientWidth}x${el.clientHeight} box`,
				});
		}

		// A type role is a class whose size is a design token (`--monti-text-<role>-size`); a color class like `text-monti-muted` is not.
		const probe = document.createElement("div");
		probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
		document.body.append(probe);
		const roles = new Map<string, { size: string } | null>();
		const roleOf = (role: string) => {
			if (!roles.has(role)) {
				probe.style.fontSize = `var(--monti-text-${role}-size)`;
				roles.set(
					role,
					getComputedStyle(root).getPropertyValue(`--monti-text-${role}-size`)
						? { size: getComputedStyle(probe).fontSize }
						: null,
				);
			}
			return roles.get(role) ?? null;
		};
		for (const el of document.body.querySelectorAll('[class*="text-monti-"]')) {
			const style = getComputedStyle(el);
			const names = (el.getAttribute("class") ?? "").split(/\s+/);
			// A role that changes at a width or a state (`md:text-monti-body`, `data-[size=sm]:text-monti-note`) is the design's own exception, and so is
			// one a parent sets for its children (`[&_[data-slot=option]]:text-monti-note`, `*:text-monti-note`).
			const changes = (name: string) => name.includes(":") && /(?:^|:)text-monti-/.test(name);
			const changedByParent = (name: string) => changes(name) && /^(?:\[&|\*:)/.test(name);
			if (names.some(changes)) continue;
			let ancestor = el.parentElement;
			while (ancestor && !(ancestor.getAttribute("class") ?? "").split(/\s+/).some(changedByParent))
				ancestor = ancestor.parentElement;
			if (ancestor) continue;
			for (const name of names) {
				const role = name.startsWith("text-monti-") ? roleOf(name.slice("text-monti-".length)) : null;
				if (!role) continue;
				if (style.fontSize !== role.size)
					findings.push({
						check: "type",
						detail: `${describe(el)} is ${name} but computes font size ${style.fontSize} (token ${role.size})`,
					});
			}
		}
		probe.remove();
		return findings;
	});
