"use client";

import * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";
import { CutWords } from "./cut-words";

/**
 * How a banner is said aloud. A screen reader reads a live region's changes, not a region that comes into the page with its words already in
 * it: whether that is read differs by reader. So the region is there first, empty, and the words are put into it afterwards:
 *
 * - a top place (`PageBannerPlace`) holds one region for all its banners, in the page from the start ({@link BannerLiveLines});
 * - a banner with no top place around it (a part's story) holds its own, filled a moment after the banner is drawn.
 *
 * Each sentence is its own line of the region, so a second banner is read alone, and the line is taken out again once it has been handed to the
 * reader: the visible banner stays to be read in the page's order, once.
 */
const BannerLive = React.createContext<((words: string) => void) | null>(null);

/** How long a sentence stays in the live region: long enough to be handed to a reader, which then says it to its end. */
const SAID_FOR = 1000;
/** How long after its own region is in the page a banner with no top place writes into it. */
const SAID_AFTER = 150;

/** The sentences being said, and how one is added: each leaves again after {@link SAID_FOR}. */
function useSaid() {
	const [lines, setLines] = React.useState<{ id: number; words: string }[]>([]);
	const next = React.useRef(0);
	const timers = React.useRef(new Set<ReturnType<typeof setTimeout>>());
	React.useEffect(() => {
		const all = timers.current;
		return () => {
			for (const timer of all) clearTimeout(timer);
		};
	}, []);
	const say = React.useCallback((words: string) => {
		const id = next.current++;
		setLines((now) => [...now, { id, words }]);
		const timer = setTimeout(() => {
			timers.current.delete(timer);
			setLines((now) => now.filter((line) => line.id !== id));
		}, SAID_FOR);
		timers.current.add(timer);
	}, []);
	return [lines, say] as const;
}

/**
 * The region itself: polite, not shown, each sentence a line of its own (a new line is read alone, a line taken out is not read). A top place
 * draws it from its first drawing, empty until a banner comes. Not for screens.
 */
function BannerLiveLines({ lines }: { lines: { id: number; words: string }[] }) {
	return (
		<div data-slot="banner-live" aria-live="polite" aria-atomic="false" aria-relevant="additions" className="sr-only">
			{lines.map((line) => (
				<p key={line.id}>{line.words}</p>
			))}
		</div>
	);
}

/**
 * A one-line notice across the very top of a screen, over its header, for something the writer should know about the whole page ("The Korean source
 * changed"): cream background and one rule below. Where it stands is not its own: a screen gives it to the top place (`PageBanner`, or the `banner`
 * of `SidebarInset` and `StandalonePage`). A 6px dot leads the sentence, 8px before its words. `tone="warning"` (the default) sets the sentence in the warning text color and the dot in the
 * warning mark color; `tone="danger"` is for something that failed (a delivery, a save) and makes both red; `tone="neutral"` is a state that is neither (an
 * entry in the trash): both are subtle, and `meta` is a plain sentence (`plainMeta` makes it one on any tone: "This post can't be saved"). `title` is the sentence, `meta` the small detail after it in mono. Nothing wraps: on a short line the detail is cut with "…" first, then the sentence; cut words say themselves whole to a pointer on them, and to the keyboard, which stops on them while they are cut (`CutWords`); the actions are never cut; `children`
 * are what can be done about it, at the right end (text buttons: the one that goes there underlined, then the one that dismisses).
 *
 * The sentence and its detail are said aloud when the banner comes and whenever they change, through a live region that was there before them
 * ({@link BannerLive}). The banner's own box is no live region.
 */
function Banner({
	title,
	meta,
	plainMeta,
	tone = "warning",
	className,
	children,
	ref,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	/** The sentence. A banner always has one. */
	title: React.ReactNode;
	meta?: React.ReactNode;
	/** The detail is a plain sentence in the subtle ink, not a small mono one (a date, a count). On by default for `neutral`. */
	plainMeta?: boolean;
	/** `warning` for something to know, `danger` for something that failed, `neutral` for a state that is neither. */
	tone?: "warning" | "danger" | "neutral";
}) {
	const box = React.useRef<HTMLDivElement | null>(null);
	const placeSays = React.useContext(BannerLive);
	const [ownLines, ownSays] = useSaid();
	/** What was last said: the same words drawn again are not said again. */
	const said = React.useRef("");
	// After every drawing: the words are read from what is drawn (a sentence can be any node), and said when they are new.
	React.useEffect(() => {
		const words = [...(box.current?.querySelectorAll("[data-slot=banner-title], [data-slot=banner-meta]") ?? [])]
			.map((piece) => piece.textContent?.trim() ?? "")
			.filter(Boolean)
			.join(", ");
		if (words === said.current) return;
		said.current = words;
		if (words === "") return;
		if (placeSays) return placeSays(words);
		// Its own region came into the page with it: the words wait until the region is known to the reader.
		let waiting = true;
		const timer = setTimeout(() => {
			waiting = false;
			ownSays(words);
		}, SAID_AFTER);
		return () => {
			// Drawn again before the words were said: they are still to say.
			if (!waiting) return;
			clearTimeout(timer);
			said.current = "";
		};
	});
	const ink = tone === "danger" ? "text-monti-danger" : tone === "neutral" ? "text-monti-subtle" : "text-monti-warning";
	const dot = (
		<span
			aria-hidden="true"
			data-slot="banner-dot"
			className={cn(
				"size-1.5 shrink-0 rounded-monti-full",
				tone === "danger" ? "bg-(--monti-fg-danger)" : tone === "neutral" ? "bg-current" : "bg-monti-warning-emphasis",
			)}
		/>
	);
	return (
		<div
			data-slot="banner"
			data-tone={tone}
			// A note of the page, found by its role; not a live region (above).
			role="note"
			ref={(node) => {
				box.current = node;
				if (typeof ref === "function") return ref(node);
				if (ref) ref.current = node;
			}}
			className={cn(
				"flex items-center gap-monti-16 border-monti-default border-b bg-monti-tool px-monti-24 py-monti-10 text-monti-note",
				className,
			)}
			{...props}
		>
			<span className={cn("inline-flex min-w-0 items-center gap-monti-8 font-semibold", ink)}>
				{dot}
				{/* A sentence longer than the line ends in "…"; while it is cut it says itself whole, and the Tab key stops on it. */}
				<CutWords stop render={<span data-slot="banner-title" className="min-w-0 truncate" />}>
					{title}
				</CutWords>
			</span>
			{meta && (
				<CutWords
					stop
					render={
						(plainMeta ?? tone === "neutral") ? (
							<span data-slot="banner-meta" className="min-w-0 shrink-[999] truncate text-monti-subtle" />
						) : (
							<Count data-slot="banner-meta" className="min-w-0 shrink-[999] truncate" />
						)
					}
				>
					{meta}
				</CutWords>
			)}
			{children && (
				<span className="ml-auto flex shrink-0 items-center gap-monti-16 whitespace-nowrap">{children}</span>
			)}
			{!placeSays && <BannerLiveLines lines={ownLines} />}
		</div>
	);
}

export { Banner, BannerLive, BannerLiveLines, useSaid };
