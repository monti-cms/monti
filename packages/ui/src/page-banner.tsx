"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Stack } from "./stack";

/**
 * Where a screen's banners stand: `undefined` outside any top place, `null` until the place is in the document, then its node.
 */
const PageBannerContext = React.createContext<HTMLElement | null | undefined>(undefined);

/**
 * The one place a screen's banners stand: the very top, edge to edge, over everything under it. `banner` is what the frame itself says (the whole
 * site's states); what a page gives through {@link PageBanner} stands under it, so the wider matter stays on top. The place takes no room while it
 * holds nothing. Not for screens: `SidebarInset` and {@link StandalonePage} are the two that have it.
 */
function PageBannerPlace({
	banner,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "className"> & { banner?: React.ReactNode }) {
	// State, not a ref: a page's banner is drawn into this node, so the page draws again once the node is there (in the same commit, before paint).
	const [place, setPlace] = React.useState<HTMLElement | null>(null);
	return (
		<PageBannerContext.Provider value={place}>
			<div className="shrink-0" {...props}>
				{banner}
				{/* A node of its own after the frame's banners: one of those shown later still lands above the page's. */}
				<div ref={setPlace} data-slot="page-banner" className="contents" />
			</div>
			{children}
		</PageBannerContext.Provider>
	);
}

/**
 * A page's own banner (a refused save, keys that cannot be read). The page renders it wherever its state lives; it is drawn at the very top of the
 * screen, in the top place of the frame around it (`SidebarInset`, {@link StandalonePage}): under the frame's own banners, edge to edge, the page and
 * its corner moving down under it. It comes before the page in the document, so it is read first, as the frame's banners are. Several stand in the
 * order they appear; put the banners of one page in one `PageBanner`, wider matter first. Nothing is drawn while it has no children. With no frame
 * around it (a part's story, a test of one page) the children are drawn where it stands.
 */
function PageBanner({ children }: { children?: React.ReactNode }) {
	const place = React.useContext(PageBannerContext);
	if (place === undefined) return children;
	return place ? createPortal(children, place) : null;
}

/**
 * A screen outside the sidebar's frame (an editor, a compare view): as tall as the window, on the page ground, its parts stacked with no gap (the
 * head row, the panes, the status bar). `banner` is every banner of the screen, at its very top over the head row, wider matter first; a part
 * deeper in the screen gives its own through {@link PageBanner}.
 */
function StandalonePage({ banner, children }: { banner?: React.ReactNode; children?: React.ReactNode }) {
	return (
		<Stack data-slot="standalone-page" gap={0} height="screen" overflow="clip" background="page">
			<PageBannerPlace data-slot="standalone-page-banner" banner={banner}>
				{children}
			</PageBannerPlace>
		</Stack>
	);
}

export { PageBanner, PageBannerPlace, StandalonePage };
