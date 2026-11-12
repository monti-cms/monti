import { type MouseEvent, useCallback, useEffect, useState } from "react";

/**
 * Where the admin is: its address is the hash (`#/c/post?status=draft`), so the site mounts one admin path, and reload, a new tab and back open the
 * same screen (T37, doc 06 decisions).
 */
export type Route =
	| { screen: "list"; collection: string; params: URLSearchParams }
	/** An entry in the editor; `compare` shows the comparison over it (`?compare=conflict` or `?compare=draft`, screens.md EditorCompare). */
	| { screen: "entry"; collection: string; id: string; compare?: "conflict" | "draft" }
	/** Settings (doc 12): its four tabs share one draft, so moving between them is a move inside one screen. */
	| { screen: "settings"; tab: SettingsTab }
	/** The media library (doc 09): its folder, filters and the open file are in the address. */
	| { screen: "media"; params: URLSearchParams }
	/** The trash (doc 11): the open folder, the search, the filters and the row open beside the list are in the address. */
	| { screen: "trash"; params: URLSearchParams }
	/** The activity log (doc 13): what it is searched and filtered by, its order, its page and the open line are in the address. */
	| { screen: "activity"; params: URLSearchParams }
	/** Tools: its templates, or with `tab` another of its tabs (`#/tools/keys`). */
	| { screen: "place"; place: "tools"; tab?: "keys" }
	/** One proposal of the assistant's, to look through and take or leave change by change (doc 10; screens/assistant.md). */
	| { screen: "review"; id: string }
	/** The template editor, a page of its own outside the frame (tools.md); `id` is `null` for a new template. */
	| { screen: "template"; id: string | null }
	| { screen: "home" };

export const SETTINGS_TABS = ["site", "languages", "collections", "admin"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const PLACES = new Set(["tools"]);

const LAST = "monti.lastScreen";

export function parseRoute(hash: string): Route {
	const [path = "", search = ""] = hash.replace(/^#/, "").split("?");
	const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
	if (parts[0] === "c" && parts[1]) {
		if (parts[2]) {
			const compare = new URLSearchParams(search).get("compare");
			return {
				screen: "entry",
				collection: parts[1],
				id: parts[2],
				...(compare === "conflict" || compare === "draft" ? { compare } : {}),
			};
		}
		return { screen: "list", collection: parts[1], params: new URLSearchParams(search) };
	}
	if (parts[0] === "settings") {
		const tab = SETTINGS_TABS.find((each) => each === parts[1]);
		return { screen: "settings", tab: tab ?? "site" };
	}
	if (parts[0] === "templates" && parts[1]) return { screen: "template", id: parts[1] === "new" ? null : parts[1] };
	if (parts[0] === "media") return { screen: "media", params: new URLSearchParams(search) };
	if (parts[0] === "trash") return { screen: "trash", params: new URLSearchParams(search) };
	if (parts[0] === "ai" && parts[1] === "review" && parts[2]) return { screen: "review", id: parts[2] };
	if (parts[0] === "activity") return { screen: "activity", params: new URLSearchParams(search) };
	if (parts[0] && PLACES.has(parts[0]))
		return { screen: "place", place: "tools", ...(parts[1] === "keys" ? { tab: "keys" as const } : {}) };
	return { screen: "home" };
}

/**
 * What a link to a screen takes: its address, and a press that goes there in this tab. With a key held that asks for another place (a new tab, a new
 * window) the press is left to the browser, which follows the address.
 */
export function linkTo(route: Route, go: (route: Route) => void) {
	return {
		href: href(route),
		onClick: (event: MouseEvent) => {
			if (event.metaKey || event.ctrlKey || event.shiftKey) return;
			event.preventDefault();
			go(route);
		},
	};
}

/** The hash of a route: what links carry, so "open in a new tab" opens the same screen. */
export function href(route: Route): string {
	switch (route.screen) {
		case "list": {
			const search = route.params.toString();
			return `#/c/${encodeURIComponent(route.collection)}${search ? `?${search}` : ""}`;
		}
		case "entry":
			return `#/c/${encodeURIComponent(route.collection)}/${encodeURIComponent(route.id)}${route.compare ? `?compare=${route.compare}` : ""}`;
		case "settings":
			return `#/settings/${route.tab}`;
		case "media": {
			const search = route.params.toString();
			return `#/media${search ? `?${search}` : ""}`;
		}
		case "trash": {
			const search = route.params.toString();
			return `#/trash${search ? `?${search}` : ""}`;
		}
		case "activity": {
			const search = route.params.toString();
			return `#/activity${search ? `?${search}` : ""}`;
		}
		case "place":
			return `#/${route.place}${route.tab ? `/${route.tab}` : ""}`;
		case "review":
			return `#/ai/review/${encodeURIComponent(route.id)}`;
		case "template":
			return `#/templates/${route.id === null ? "new" : encodeURIComponent(route.id)}`;
		case "home":
			return "#/";
	}
}

const read = () => {
	try {
		return localStorage.getItem(LAST);
	} catch {
		return null;
	}
};

/**
 * The route in the address. Opening the admin with no route reopens the last screen of this browser (doc 15, the sign-in flow's "last screen").
 * `go` adds a history entry; `{ replace: true }` changes the address in place (typing in the search box).
 */
export function useRoute() {
	const [hash, setHash] = useState(() => {
		const current = window.location.hash;
		if (parseRoute(current).screen !== "home") return current;
		const last = read();
		if (last && parseRoute(last).screen !== "home") {
			window.history.replaceState(null, "", last);
			return last;
		}
		return current;
	});
	useEffect(() => {
		const follow = () => setHash(window.location.hash);
		window.addEventListener("hashchange", follow);
		window.addEventListener("popstate", follow);
		return () => {
			window.removeEventListener("hashchange", follow);
			window.removeEventListener("popstate", follow);
		};
	}, []);
	useEffect(() => {
		if (parseRoute(hash).screen === "home") return;
		try {
			localStorage.setItem(LAST, hash);
		} catch {}
	}, [hash]);
	const go = useCallback((route: Route, options: { replace?: boolean } = {}) => {
		const next = href(route);
		if (next === window.location.hash) return;
		if (options.replace) window.history.replaceState(null, "", next);
		else window.history.pushState(null, "", next);
		setHash(next);
	}, []);
	return { route: parseRoute(hash), go };
}
