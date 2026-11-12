"use client";

import {
	type ComponentProps,
	type CSSProperties,
	type FormEventHandler,
	type ReactNode,
	useId,
	useLayoutEffect,
	useRef,
} from "react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { ChevronLeft, Close } from "./icons";
import { useUiLabels } from "./labels";
import { ResizeHandle, useResizableWidth } from "./resize-handle";

/**
 * The look of a tool panel, shared by `SidePanel` and `Sheet`: a cream ground, a 60px head (title 16px bold at the start, icon buttons at the end, 24px
 * in and 12 out), a body with 20px above and 24 at the sides, and a foot that holds the one pill.
 */
export const PANEL_HEAD =
	"flex h-monti-header shrink-0 items-center gap-monti-4 border-monti-default border-b pr-monti-12 pl-monti-24";
export const PANEL_TITLE = "min-w-0 grow truncate text-monti-default text-monti-title";
export const PANEL_BODY = "flex flex-col gap-monti-20 px-monti-24 py-monti-20";
export const PANEL_FOOT =
	"flex shrink-0 items-center justify-end gap-monti-20 border-monti-default border-t px-monti-24 py-monti-12";

/** What can open a panel: a control a person presses. */
const OPENERS = 'a[href], button, [role="button"], [role="menuitem"], [tabindex]';

/**
 * The widths a side panel starts at (the `width-panel`, `width-side-panel` and `width-assistant` tokens): `side` for a file or an activity beside a
 * list, `panel` for the entry's properties, `assistant` for the assistant. The writer can drag it up to twice as wide, never narrower.
 */
const SIDE_PANEL_WIDTH = {
	side: 360,
	panel: 300,
	assistant: 380,
} as const;

/**
 * A panel beside a screen, for what is looked at together with it (a media file, an activity, an entry's properties, the assistant): it does not
 * cover the screen. A width by `width` that the writer can drag wider from its left edge (remembered in this browser under `resizeKey`), a cream ground, a line down its left edge, and a 60px head with the title (16px bold), the panel's
 * icon buttons and the close button. Under the body an optional foot holds the one pill, or the box to type in. Docked at the window's right edge,
 * it covers the ✦ button of the page's corner. The panel is named by its title. Put it in a row beside the screen; on a narrow screen it takes the whole width. With `onSubmit` the body and the foot are one form, so Enter
 * in a field and the foot's submit button save it.
 *
 * Closed with the keyboard while focus is in it (its ×, a shortcut), the panel gives focus back to what opened it: the row. A pointer press
 * moves nothing. The panel remembers its opener itself, and a screen passes nothing: it is the control that had focus when the panel came, or
 * the last control outside it that was used since (another row opened into the same panel). Where focus merely passed on its way into the
 * panel (the last row before it, by Tab) is not it. An opener that has left the page (a menu's item) gives its place to what focus goes to
 * next (the menu's button).
 */
export function SidePanel({
	title,
	bar,
	actions,
	back,
	onClose,
	closable,
	footer,
	composer,
	width = "side",
	bleed = false,
	onSubmit,
	resizeKey,
	className,
	style,
	children,
	...props
}: Omit<ComponentProps<"aside">, "title"> & {
	/** The panel's name and its 16px head. Without it the panel has no head (give it an `aria-label`, and a `bar` if it has tabs). */
	title?: ReactNode;
	/** A row pinned at the top, under the head when there is one: the tab bar of the properties panel. */
	bar?: ReactNode;
	/** Icon buttons at the end of the head, before the close button. */
	actions?: ReactNode;
	/** A back button before the title, for a view inside the panel (the assistant's past conversations): its name ("Back to the conversation") and what it does. */
	back?: { label: string; onClick: () => void };
	onClose?: () => void;
	/** The × is drawn without `onClose` (a screen spec's look, before its behavior is wired). */
	closable?: boolean;
	/** Pinned under the body. */
	footer?: ReactNode;
	/** The box to type in, pinned under the body with no line over it (the assistant's chat input), 12px above it and 16 at the sides and below. */
	composer?: ReactNode;
	width?: keyof typeof SIDE_PANEL_WIDTH;
	/** The body keeps no padding or gap of its own: for content that lays out its own sections edge to edge (tabs, bands). */
	bleed?: boolean;
	onSubmit?: FormEventHandler<HTMLFormElement>;
	/** The name its width is remembered under; `panel:<width>` by default, so panels of one kind share it. */
	resizeKey?: string;
}) {
	const labels = useUiLabels();
	const start = SIDE_PANEL_WIDTH[width];
	const resize = useResizableWidth({
		storageKey: resizeKey ?? `panel:${width}`,
		defaultWidth: start,
		min: start,
		max: start * 2,
	});
	const titleId = useId();
	const panel = useRef<HTMLElement>(null);
	/** What opened the panel. */
	const from = useRef<HTMLElement | null>(null);
	/** Whether the last press in the panel was a key's, not a pointer's. */
	const keys = useRef(false);
	useLayoutEffect(() => {
		const node = panel.current;
		const outside = (target: EventTarget | null): target is HTMLElement =>
			target instanceof HTMLElement && target !== document.body && !node?.contains(target);
		const active = document.activeElement;
		if (outside(active)) from.current = active;
		// A control outside the panel that is used while the panel is open is its opener from then on.
		const used = (event: MouseEvent) => {
			const control = event.target instanceof Element ? event.target.closest(OPENERS) : null;
			if (outside(control)) from.current = control;
		};
		// The opener left the page (a menu's item, once its menu closed): what focus goes to next stands for it.
		const next = (event: FocusEvent) => {
			if (!from.current?.isConnected && outside(event.target)) from.current = event.target;
		};
		document.addEventListener("click", used, true);
		document.addEventListener("focusin", next, true);
		// As it leaves, before its nodes do: focus still in it would fall to the document.
		return () => {
			document.removeEventListener("click", used, true);
			document.removeEventListener("focusin", next, true);
			if (!node || !keys.current || !node.contains(document.activeElement)) return;
			if (from.current?.isConnected) from.current.focus();
		};
	}, []);
	const body = (
		<div
			data-slot="side-panel-body"
			className={cn(bleed ? "flex flex-col" : PANEL_BODY, "min-h-0 flex-1 overflow-y-auto")}
		>
			{children}
		</div>
	);
	const foot = (
		<>
			{footer && (
				<footer data-slot="side-panel-footer" className={PANEL_FOOT}>
					{footer}
				</footer>
			)}
			{composer && (
				<div data-slot="side-panel-composer" className="shrink-0 px-monti-16 pt-monti-12 pb-monti-16">
					{composer}
				</div>
			)}
		</>
	);
	return (
		<aside
			data-slot="side-panel"
			aria-labelledby={title ? titleId : undefined}
			className={cn(
				"relative flex min-h-0 w-full min-w-0 shrink-0 flex-col bg-monti-tool shadow-[inset_1px_0_0_var(--monti-border-default)] sm:w-(--side-panel-width)",
				className,
			)}
			style={{ "--side-panel-width": `${resize.width}px`, ...style } as CSSProperties}
			{...props}
			ref={panel}
			onKeyDownCapture={(event) => {
				keys.current = true;
				props.onKeyDownCapture?.(event);
			}}
			onPointerDownCapture={(event) => {
				keys.current = false;
				props.onPointerDownCapture?.(event);
			}}
		>
			<ResizeHandle
				value={resize.width}
				min={resize.min}
				max={resize.max}
				onChange={resize.setWidth}
				onReset={resize.reset}
				edge="start"
				resizing={resize.resizing}
				className="max-sm:hidden"
			/>
			{title && (
				<header data-slot="side-panel-header" className={PANEL_HEAD}>
					{back && (
						<IconButton label={back.label} side="bottom" onClick={back.onClick} className="-ml-monti-12">
							<ChevronLeft aria-hidden />
						</IconButton>
					)}
					<h2 id={titleId} className={PANEL_TITLE}>
						{title}
					</h2>
					{actions}
					{(onClose || closable) && (
						<IconButton label={labels.close} side="bottom" onClick={onClose}>
							<Close aria-hidden />
						</IconButton>
					)}
				</header>
			)}
			{bar}
			{onSubmit ? (
				<form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
					{body}
					{foot}
				</form>
			) : (
				<>
					{body}
					{foot}
				</>
			)}
		</aside>
	);
}
