"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { BannerLive, BannerLiveLines, useSaid } from "./banner";
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
	const [lines, say] = useSaid();
	return (
		<PageBannerContext.Provider value={place}>
			<BannerLive.Provider value={say}>
				<div className="shrink-0" {...props}>
					{/* The banners' live region is here before any of them, empty: what comes later is said (banner.tsx). */}
					<BannerLiveLines lines={lines} />
					{banner}
					{/* A node of its own after the frame's banners: one of those shown later still lands above the page's. Each sender has its box in it. */}
					<div ref={setPlace} data-slot="page-banner" className="contents" />
				</div>
				{children}
			</BannerLive.Provider>
		</PageBannerContext.Provider>
	);
}

/** Each sender's box in a top place → the mark that says where its sender stands in the page. */
const marks = new WeakMap<Element, Element>();
/** The top places that watch the page for a sender moved to another place. */
const watches = new WeakMap<Element, MutationObserver>();

/**
 * Puts the boxes of a top place in the order their senders stand in the page (the order of their marks in the document, which is the order the
 * page wrote them), whatever the time each was filled. A box already in its place is not touched, so what has the focus in it keeps it.
 *
 * While a place has two senders or more it watches the document: a page can turn its parts around without drawing them again, and then nothing
 * but the document says so. With one sender there is no order to keep and nothing is watched.
 */
function order(place: HTMLElement) {
	const boxes = [...place.children].filter((box) => marks.has(box));
	const before = (a: Element, b: Element) =>
		(marks.get(a) as Element).compareDocumentPosition(marks.get(b) as Element) & Node.DOCUMENT_POSITION_FOLLOWING
			? -1
			: 1;
	[...boxes].sort(before).forEach((box, index) => {
		if (place.children[index] !== box) place.insertBefore(box, place.children[index] ?? null);
	});
	const watch = watches.get(place);
	if (boxes.length < 2) {
		watch?.disconnect();
		watches.delete(place);
	} else if (!watch) {
		const made = new MutationObserver(() => order(place));
		made.observe(place.ownerDocument.body, { childList: true, subtree: true });
		watches.set(place, made);
	}
}

/**
 * A page's own banner (a refused save, keys that cannot be read). The page renders it wherever its state lives; it is drawn at the very top of the
 * screen, in the top place of the frame around it (`SidebarInset`, {@link StandalonePage}): under the frame's own banners, edge to edge, the page and
 * its corner moving down under it. It comes before the page in the document, so it is read first, as the frame's banners are.
 *
 * Several stand in the order the page wrote them (the order they stand in the page, not the time each was filled or shown), and follow the page
 * when it moves its parts; within one `PageBanner`, in the order of its children. So a page writes the wider matter first. Nothing is drawn while
 * it has no children; where it stands it leaves a hidden mark, which is how its place in the page is known. With no frame around it (a part's
 * story, a test of one page) the children are drawn where it stands.
 */
function PageBanner({ children }: { children?: React.ReactNode }) {
	const place = React.useContext(PageBannerContext);
	const mark = React.useRef<HTMLSpanElement>(null);
	// This sender's own box in the top place: its children are drawn into it, so the box, not the time they come, holds their position.
	const [box, setBox] = React.useState<HTMLElement | null>(null);
	React.useLayoutEffect(() => {
		if (!place || !mark.current) {
			setBox(null);
			return;
		}
		const made = place.ownerDocument.createElement("div");
		made.dataset.slot = "page-banner-sender";
		made.className = "contents";
		marks.set(made, mark.current);
		place.append(made);
		order(place);
		setBox(made);
		return () => {
			marks.delete(made);
			made.remove();
			order(place);
		};
	}, [place]);
	if (place === undefined) return children;
	return (
		<>
			<span ref={mark} hidden data-slot="page-banner-mark" />
			{box ? createPortal(children, box) : null}
		</>
	);
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
