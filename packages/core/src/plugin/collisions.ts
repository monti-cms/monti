/**
 * 플러그인이 본체나 다른 플러그인과 같은 주소·이름을 쓰는 설정을 시작할 때 막는다. 조용히 한쪽이 가려지는 일이 없게 한다.
 * 이 모듈은 사이트 설정을 읽지 않는다(저작 API가 import한다).
 */

/** 본체 관리자 화면의 한 칸 주소(`/admin/<경로>`). 빈 글자는 목록 화면이다. 관리자 화면의 경로 고르기와 같게 둔다. */
export const CORE_ADMIN_PAGES: readonly string[] = ["", "entries", "login", "media", "templates", "trash"];

/** 본체가 관리자 메타 API `features`에 쓰는 이름. 플러그인 이름으로 쓸 수 없다. */
export const CORE_FEATURE_KEYS: readonly string[] = ["folders", "references", "search", "templates", "media"];

const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, "");
const showPage = (path: string) => `/${path}`;

/** 플러그인 이름이 본체 `features` 이름과 겹치면 오류. */
export function assertPluginNamesFree(names: readonly string[]): void {
	for (const name of names) {
		if (CORE_FEATURE_KEYS.includes(name)) {
			throw new Error(`cms plugin: plugin name "${name}" collides with the core feature "${name}"`);
		}
	}
}

/**
 * 플러그인 관리자 화면 주소(`nav`의 `path`·관리자 플러그인의 `pages` 키)가 본체 화면이나 다른 플러그인과 같으면 오류.
 * 같은 플러그인 안의 같은 주소는 한 화면이라 본다.
 */
export function assertPluginPagesFree(pages: readonly { readonly plugin: string; readonly path: string }[]): void {
	const owners = new Map<string, string>();
	for (const { plugin, path } of pages) {
		const key = trimSlashes(path);
		if (CORE_ADMIN_PAGES.includes(key)) {
			throw new Error(
				`cms plugin: admin page "${showPage(key)}" of plugin "${plugin}" collides with the core admin page "${showPage(key)}"`,
			);
		}
		const owner = owners.get(key);
		if (owner !== undefined && owner !== plugin) {
			throw new Error(
				`cms plugin: admin page "${showPage(key)}" of plugin "${plugin}" collides with plugin "${owner}" (same admin page)`,
			);
		}
		owners.set(key, plugin);
	}
}

/** `[이름]` 조각의 이름은 달라도 같은 모양이면 같은 경로로 본다. */
const shape = (pattern: string) =>
	pattern
		.split("/")
		.map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "[]" : segment))
		.join("/");

/**
 * 플러그인 API 경로가 본체 경로(`corePatterns`)·`auth/…`·다른 플러그인 경로와 같은 모양이면 오류.
 * 본체 경로가 먼저 맞아 플러그인 경로는 쓰이지 못하므로 알려 준다.
 */
export function assertPluginRoutesFree(
	corePatterns: readonly string[],
	routes: readonly { readonly plugin: string; readonly pattern: string }[],
): void {
	const core = new Map(corePatterns.map((pattern) => [shape(pattern), pattern]));
	const owners = new Map<string, { plugin: string; pattern: string }>();
	for (const { plugin, pattern } of routes) {
		const key = shape(pattern);
		const coreRoute = core.get(key);
		if (coreRoute !== undefined) {
			throw new Error(
				`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the core route "${coreRoute}"`,
			);
		}
		if (key.split("/")[0] === "auth") {
			throw new Error(
				`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the core "auth/*" routes`,
			);
		}
		const owner = owners.get(key);
		if (owner) {
			throw new Error(
				`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the route "${owner.pattern}" of plugin "${owner.plugin}"`,
			);
		}
		owners.set(key, { plugin, pattern });
	}
}
