/**
 * jsdom에 없는 브라우저 API. shadcn Sidebar(`useIsMobile`)는 matchMedia를, cmdk·Base UI 팝업은 ResizeObserver를 쓴다.
 * 테스트가 직접 정의하면 그 값을 그대로 둔다.
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
