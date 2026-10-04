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
