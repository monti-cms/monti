import { configure } from "@testing-library/react";

// The editor shell takes close to a second to render in jsdom on a quiet machine, and several times that when the whole
// monorepo suite runs in parallel. The default 1s wait of `findBy*` and `waitFor` turned that into random failures
// ("Unable to find role ..."). A condition that is met returns at once, so only a test that fails waits this long.
configure({ asyncUtilTimeout: 10_000 });

/**
 * Browser APIs missing from jsdom. The shadcn Sidebar (`useIsMobile`) uses matchMedia; cmdk and Base UI popups use ResizeObserver.
 * If a test defines them itself, that value is left as is.
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
}
