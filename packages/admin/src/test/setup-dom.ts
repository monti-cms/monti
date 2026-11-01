import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { beforeAll } from "vitest";

// The editor shell takes close to a second to render in jsdom on a quiet machine, and several times that when the whole
// monorepo suite runs in parallel. The default 1s wait of `findBy*` and `waitFor` turned that into random failures
// ("Unable to find role ..."). A condition that is met returns at once, so only a test that fails waits this long.
configure({ asyncUtilTimeout: 10_000 });

/**
 * Sonner (the toast under `@monti-cms/ui`) adds a 15 KB stylesheet to the page when it loads. jsdom matches every rule of it on each
 * `getComputedStyle`, which the role queries call for every element whose name they compute: the heaviest screen files spent a fifth of
 * their test time there. Its rules set position, motion, opacity and `display: flex`; a role query reads only `display: none` and
 * `visibility`, and how a toast looks (opacity included) is for the browser tests. So jsdom drops it; a real browser keeps it.
 */
if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) {
	beforeAll(() => {
		for (const style of document.head.querySelectorAll("style")) {
			if (style.textContent?.includes("[data-sonner-toaster]")) style.remove();
		}
	});
}

/**
 * Browser APIs missing from jsdom. The shadcn Sidebar (`useIsMobile`) uses matchMedia; cmdk and Base UI popups use ResizeObserver.
 * If a test defines them itself, that value is left as is. In a real browser (`*.browser.test.tsx`) they all exist and nothing is filled.
 */
if (typeof window !== "undefined") {
	if (typeof window.matchMedia !== "function") {
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			configurable: true,
			value: (query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				addListener: () => {},
				removeListener: () => {},
				dispatchEvent: () => false,
			}),
		});
	}
	if (typeof globalThis.ResizeObserver !== "function") {
		globalThis.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
	}
	if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
		Element.prototype.scrollIntoView = () => {};
	}
	if (typeof Range !== "undefined") {
		if (typeof Range.prototype.getClientRects !== "function") {
			Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
		}
		if (typeof Range.prototype.getBoundingClientRect !== "function") {
			Range.prototype.getBoundingClientRect = () =>
				({
					top: 0,
					bottom: 0,
					left: 0,
					right: 0,
					width: 0,
					height: 0,
					x: 0,
					y: 0,
					toJSON: () => {},
				}) as DOMRect;
		}
	}
}
