"use client";

import * as React from "react";
import { cn } from "./cn";
import { Tooltip, TooltipContent } from "./tooltip";

/**
 * Whether a box shows less than it holds: its words run past its room (a fraction of a pixel short already ends them in "…"), or a piece inside
 * it ends in its own "…" (a text button or a status in a cut cell).
 */
function cutIn(box: HTMLElement) {
	// The words' own width: every piece in the box's flow, from the first one's left to the last one's right. A piece that stands out of the
	// flow is not the box's words (a row's check hangs in the margin outside its cell).
	let left = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	const piece = document.createRange();
	for (const child of box.childNodes) {
		if (child instanceof Element && ["absolute", "fixed"].includes(getComputedStyle(child).position)) continue;
		piece.selectNode(child);
		const at = piece.getBoundingClientRect();
		if (at.width === 0 && at.height === 0) continue;
		left = Math.min(left, at.left);
		right = Math.max(right, at.right);
	}
	const style = getComputedStyle(box);
	const sides = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"] as const;
	const room = box.getBoundingClientRect().width - sides.reduce((sum, side) => sum + Number.parseFloat(style[side]), 0);
	if (right - left > room + 0.01) return true;
	for (const piece of box.querySelectorAll<HTMLElement>("*")) {
		if (piece.scrollWidth > piece.clientWidth && getComputedStyle(piece).textOverflow === "ellipsis") return true;
	}
	return false;
}

/**
 * Words cut to their box with "…" that say themselves whole. While they are cut, pointing at them, or coming with the keyboard to them or to
 * something inside them (a row's link), says them whole in a tooltip. Every place that cuts words uses this one part: a row's title, a table's
 * cut cell, a banner's sentence, a row's languages.
 *
 * - The pointer is asked for by its place, not by `pointerenter`: a row's link covers its whole row, so the pointer is "on the link"
 *   everywhere on the row, and the tooltip is for the pointer on the words themselves.
 * - The keyboard: focus that comes to the words, to something inside them (a row's link) or to the button or link that holds them (a
 *   file's use row) says them. With `stop` the words themselves are a stop while cut, with the system's focus ring drawn inside the box.
 * - Escape or a press closes it, and it then stays closed until the pointer has left the words.
 * - The tooltip is only made while it shows: a list of fifty rows holds no tooltip until one is asked for.
 */
function CutWords({
	render,
	whole,
	partial = false,
	stop = false,
	className,
	children,
}: {
	/** The box that cuts the words, when it is not a plain span: a table's cell. It gets the pointer's and the keyboard's listeners. */
	render?: React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
	/** What it says, when that is not the box's own words (a row's languages by name, where the box counts them). */
	whole?: string;
	/** It shows less than `whole` though nothing is cut with "…" (languages only counted): it says `whole` all the same. */
	partial?: boolean;
	/**
	 * While they are cut the words are a stop of the Tab key, so the keyboard alone can read them whole. For words that hold nothing the keyboard
	 * comes to and stand once on a screen (a banner's sentence); not for a table's cells, where it would add a stop to every cut cell of every row.
	 */
	stop?: boolean;
	className?: string;
	children?: React.ReactNode;
}) {
	const box = React.useRef<HTMLElement | null>(null);
	/** The box as it is in the page now: measured again when another element takes its place (a banner's detail that changes its kind). */
	const [node, setNode] = React.useState<HTMLElement | null>(null);
	/** Open, and by what: the pointer on the words, or the keyboard on them. */
	const [by, setBy] = React.useState<"pointer" | "keys" | null>(null);
	/** What it says. Kept while it closes, so the tooltip does not empty before it is gone. */
	const [words, setWords] = React.useState("");
	/** Whether the words are cut now: only measured for words that are a Tab stop while they are. */
	const [stops, setStops] = React.useState(false);
	/** Whether the pointer is on the words now. */
	const onWords = React.useRef(false);
	/** Closed by hand (Escape, a press) with the pointer on the words, whatever opened it: it stays closed until the pointer has left them. */
	const dismissed = React.useRef(false);
	const dismiss = () => {
		dismissed.current = onWords.current;
		setBy(null);
	};
	const say = (how: "pointer" | "keys") => {
		const words = box.current;
		if (!words || !(partial || cutIn(words))) return;
		const said = whole ?? words.textContent ?? "";
		if (said === "") return;
		setWords(said);
		setBy(how);
	};
	/** The pointer is no longer on the words: what it opened closes, and what was closed by hand may open again. */
	const left = () => {
		onWords.current = false;
		dismissed.current = false;
		if (by === "pointer") setBy(null);
	};

	React.useLayoutEffect(() => {
		if (!stop || !node) return;
		const measure = () => setStops(partial || cutIn(node));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [stop, partial, node]);

	// Words inside a button or a link (a file's use row, the proposal bubble's name): the keyboard comes to that control, not into the words,
	// so the words listen to it. Words that hold the control themselves (a row's title and its link) hear the focus as it bubbles, below.
	const sayRef = React.useRef(say);
	sayRef.current = say;
	const byRef = React.useRef(by);
	byRef.current = by;
	React.useEffect(() => {
		const holder = box.current?.parentElement?.closest<HTMLElement>("a[href], button");
		if (!holder) return;
		const come = () => {
			if (holder.matches(":focus-visible")) sayRef.current("keys");
		};
		const gone = () => {
			if (byRef.current === "keys") setBy(null);
		};
		holder.addEventListener("focus", come);
		holder.addEventListener("blur", gone);
		return () => {
			holder.removeEventListener("focus", come);
			holder.removeEventListener("blur", gone);
		};
	}, []);

	// Escape closes it wherever the focus is: the pointer's tooltip has no focus of its own.
	const open = by !== null;
	React.useEffect(() => {
		if (!open) return;
		const key = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			dismissed.current = onWords.current;
			setBy(null);
		};
		document.addEventListener("keydown", key, true);
		return () => document.removeEventListener("keydown", key, true);
	}, [open]);

	const element = render ?? <span />;
	const own = element.props;
	const given = own.ref;
	const cutBox = React.cloneElement(
		element,
		{
			ref: (made: HTMLElement | null) => {
				box.current = made;
				if (stop) setNode(made);
				if (typeof given === "function") given(made);
				else if (given) (given as React.RefObject<HTMLElement | null>).current = made;
			},
			"data-slot": (own as { "data-slot"?: string })["data-slot"] ?? "cut-words",
			"data-cut-words": whole ?? "",
			tabIndex: stop && stops ? 0 : own.tabIndex,
			className: cn(
				!render && "min-w-0 truncate",
				// While it is a stop it draws the keyboard's ring, inside its box: the box cuts what runs past it, a ring outside too.
				stop &&
					stops &&
					"rounded-monti-sm outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50 focus-visible:ring-inset",
				own.className,
				className,
			),
			onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
				own.onPointerMove?.(event);
				// A finger that starts a scroll here is not pointing.
				if (event.pointerType === "touch") return;
				const edge = event.currentTarget.getBoundingClientRect();
				const on =
					event.clientX >= edge.left &&
					event.clientX <= edge.right &&
					event.clientY >= edge.top &&
					event.clientY <= edge.bottom;
				if (!on) return left();
				onWords.current = true;
				if (by === null && !dismissed.current) say("pointer");
			},
			onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
				own.onPointerLeave?.(event);
				left();
			},
			onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
				own.onPointerDown?.(event);
				if (by !== null) dismiss();
			},
			onFocus: (event: React.FocusEvent<HTMLElement>) => {
				own.onFocus?.(event);
				// The keyboard's focus only: a press that focuses a link in the words says nothing.
				if (event.target.matches(":focus-visible")) say("keys");
			},
			onBlur: (event: React.FocusEvent<HTMLElement>) => {
				own.onBlur?.(event);
				if (by === "keys") setBy(null);
			},
		} as React.HTMLAttributes<HTMLElement>,
		children ?? own.children,
	);
	return (
		<>
			{cutBox}
			{/* Kept while it closes (its words stay), and not made before it is first asked for. */}
			{words !== "" && (
				<Tooltip
					open={open}
					onOpenChange={(next) => {
						// What the library closes it for (a press outside); the pointer and the keyboard are heard above.
						if (!next && by !== null) dismiss();
					}}
				>
					{/* Words can be long: they wrap in the tooltip instead of running off the window. */}
					<TooltipContent anchor={box} align="start" className="max-w-monti-panel whitespace-normal break-words">
						{words}
					</TooltipContent>
				</Tooltip>
			)}
		</>
	);
}

export { CutWords };
