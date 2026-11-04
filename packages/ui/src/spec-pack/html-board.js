// Monti's HTML board classes, for the screen spec tool's HTML adapter (`scripts/convert-board/html-adapter.js`): the design system's CSS classes on a canvas
// board (`.mt-btn--primary`) and the part each one draws. Loaded into the board's page before the adapter.

/** The text role of an element (`text-page` is `page`). */
const role = (el) => [...el.classList].find((name) => name.startsWith("text-"))?.slice(5);

/** The design system's classes and the part each one draws, first match wins. `props` reads the element's own values. */
/** The rows a list section's heading goes with: the next `div.mt-table` after it. */
const rowsAfter = (el) => {
	const all = [...document.querySelectorAll("h2.mt-table-head, div.mt-table")];
	const next = all[all.indexOf(el) + 1];
	return next?.matches("div.mt-table") ? next : null;
};

/** Whether a list's rows have a head row before them. */
const headBefore = (el) => {
	const all = [...document.querySelectorAll(".mt-list-head, .mt-table")];
	return all[all.indexOf(el) - 1]?.matches(".mt-list-head") ?? false;
};

/** The rows a list's head row goes with: the next `.mt-table` among the elements after it (the board's runtime may wrap either). */
const tableAfter = (el) => {
	const all = [...document.querySelectorAll(".mt-list-head, .mt-table")];
	const next = all[all.indexOf(el) + 1];
	return next?.matches(".mt-table") ? next : null;
};

/** The name of an icon of the design system's list with this svg's shape (`icon-key.js`, `window.boardData.icons`), if there is one. */
// An entry's words as a run of pieces: plain, taken out (`del`) and put in (`ins`).
const markedRun = (el) =>
	el
		? [...el.childNodes]
				.map((node) => ({
					kind: node.nodeName === "DEL" ? "del" : node.nodeName === "INS" ? "ins" : undefined,
					text: node.textContent,
				}))
				.filter((piece) => piece.text.trim() !== "")
		: undefined;
// A row of a review page: one that follows a group's head, or one of its side-by-side blocks.
const reviewRow = (el) =>
	el.parentElement?.querySelector(":scope > h2.mt-toolbar") != null ||
	el.parentElement?.parentElement?.querySelector(":scope > h2.mt-toolbar") != null;
// The blocks of an entry's body, read as the data gives them: the editor's own tools in it (a block's handle and menu, the bar over a selection) are
// its states, not the body's, and the line that asks for the first block is the editor's.
// Each block starts with a piece that has its `kind` (h2, h3, p, li, quote, figure); the pieces after it go on the same block, the words a proposal
// takes out (`del`) and puts in (`ins`) marked as such.
const EDITOR_TOOLS = ".mt-card, .mt-handle, .mt-format-bar, .mt-block-bar, .mt-memo, .mt-marker";
const bodyBlocks = (el) =>
	[...el.querySelectorAll("h2, h3, p, li, blockquote, figure")]
		.filter((block) => !block.closest(`${EDITOR_TOOLS}, figure figure, blockquote p`))
		.filter((block) => !(block.matches("p") && block.style.color.includes("--fg-faint")))
		.flatMap((block) => {
			const copy = block.cloneNode(true);
			for (const tool of copy.querySelectorAll(`${EDITOR_TOOLS}, button`)) tool.remove();
			const kind = block.matches("blockquote") ? "quote" : block.tagName.toLowerCase();
			const untranslated = block.matches(".mt-untranslated") || undefined;
			const pieces = [...copy.childNodes]
				.map((node) => ({
					mark: node.nodeName === "DEL" ? "del" : node.nodeName === "INS" ? "ins" : undefined,
					text: node.textContent.replace(/\s+/g, " "),
				}))
				.filter((piece) => piece.text.trim() !== "");
			if (pieces.length === 0) return kind === "figure" ? [{ kind, text: "" }] : [];
			return pieces.map((piece, index) =>
				index === 0 ? { kind, ...piece, text: piece.text.trimStart(), untranslated } : piece,
			);
		});
// Whether an element has words of its own, not only in its children.
// (A board's data fills its words in a span of its runtime's: those are its own words too.)
const ownText = (el) =>
	[...(el?.childNodes ?? [])].some(
		(node) =>
			(node.nodeType === Node.TEXT_NODE || node.classList?.contains("sc-interp")) && node.textContent.trim() !== "",
	);
// An option row's own words, without its note, its count or its control.
const choiceLabel = (el) =>
	[...el.childNodes]
		.filter((node) => node.nodeType === Node.TEXT_NODE)
		.map((node) => node.textContent)
		.join("")
		.trim();
// A head's close button: drawn as "×" or as the close icon.
const closes = (button) =>
	button.textContent.trim() === "×" ||
	(button.querySelector("svg") !== null && iconName(button.querySelector("svg")) === "close");
const iconName = (el) => window.boardData?.icons?.[window.iconShapeKey?.(el.innerHTML)];

const parts = [
	{
		match: (el) => el.tagName.toLowerCase() === "svg" && iconName(el) !== undefined,
		part: "Icon",
		props: (el) => ({ name: iconName(el) }),
		leaf: true,
	},
	// The sidebar, drawn flat; the pack's sidebar entries put the design system's layers in.
	{ match: (el) => el.matches(".mt-tooltip") || el.matches(".mt-card:has(.mt-menu-item)"), ignore: true },
	// The empty space that pushes the bottom list down is the sidebar's own: its content takes the height.
	{ match: (el) => el.matches("nav.mt-sidebar > div:empty"), ignore: true },
	{
		match: (el) => el.matches("nav.mt-sidebar"),
		part: "Sidebar",
		props: (el) => ({ rail: el.classList.contains("is-rail") || undefined }),
		asProps: ["min-height", "height", "flex-shrink"],
	},
	{ match: (el) => el.matches(".mt-sidebar-head"), part: "SidebarHeader" },
	{ match: (el) => el.matches(".mt-sidebar-head > .mt-icon-btn"), part: "SidebarRailToggle", leaf: true },
	{
		match: (el) => el.matches("div:has(> .mt-nav)"),
		part: "SidebarNav",
		props: (el) => ({ place: el.querySelector(":scope > .mt-sidebar-foot") ? "bottom" : "top" }),
		// The rows' gap, and the bottom list's line and room above it, are the menu's and the footer's own.
		asProps: ["gap", "border-top", "padding-top"],
	},
	{
		match: (el) => el.matches(".mt-sidebar .mt-nav"),
		part: "SidebarItem",
		props: (el) => ({ active: el.classList.contains("is-on") || undefined }),
	},
	{
		match: (el) => el.matches(".mt-nav > .n"),
		part: "SidebarCount",
		props: (el) => ({ tone: /--fg-warning/.test(el.style.color) ? "warning" : undefined }),
		asProps: ["color"],
	},
	{ match: (el) => el.matches(".mt-change-dot"), part: "ChangeDot", leaf: true },
	{ match: (el) => el.matches(".mt-nav-sub"), part: "SidebarSub" },
	{
		match: (el) => el.matches(".mt-nav-sub > a"),
		part: "SidebarSubItem",
		props: (el) => ({
			active: el.classList.contains("is-on") || undefined,
			// A folder inside another sits 14px further in a level.
			depth: Math.round((Number.parseFloat(el.style.paddingLeft) || 0) / 14) || undefined,
		}),
		asProps: ["color", "font-weight", "padding-left"],
	},
	{ match: (el) => el.matches(".mt-count") && !el.matches(".mt-row > *, footer"), part: "Count" },
	{ match: (el) => el.matches(".mt-sidebar-foot"), part: "SidebarFoot" },
	{
		match: (el) => el.matches(".mt-sidebar-foot > .mt-seg, .mt-sidebar-foot > .mt-icon-btn"),
		part: "SidebarScreenMode",
		props: (el) => {
			const on = [...el.querySelectorAll(":scope > button")].findIndex((button) => button.classList.contains("is-on"));
			const icon = iconName(el.querySelector("svg") ?? el);
			const value = on >= 0 ? ["system", "light", "dark"][on] : ({ light: "light", asleep: "dark" }[icon] ?? "system");
			return { value, defaultOpen: document.querySelector(".mt-card .mt-menu-item") ? true : undefined };
		},
		leaf: true,
		asProps: ["flex"],
	},
	// A board drawn inside this board (the sidebar beside a page) and the runtime's host around it.
	{ match: (el) => el.matches(".sc-host, .sc-host > .mt, .mt .mt"), frame: true },
	// The screen beside a panel: its place in the app's frame.
	{ match: (el) => el.matches(".mt > div:has(> .sc-host):has(+ aside.mt-panel)"), frame: true },
	// A content page's head: the title, the address rule, the actions at the end.
	{
		match: (el) => el.matches(".mt-page-header"),
		part: "PageHeader",
		slots: (el) => ({ title: el.querySelector(":scope > h1"), meta: el.querySelector(":scope > .meta") }),
		children: (el) => el.querySelector(":scope > .end"),
		// A header that keeps its place over the scrolling page (the page column's own: its body scrolls under it).
		asProps: ["position", "top", "z-index", "background", "padding-top"],
	},
	// A list's section: its heading row and its rows are neighbours in a board, one section in the design system.
	{
		match: (el) => el.matches("h2.mt-table-head") && rowsAfter(el) !== null,
		part: "ListSection",
		group: (el) => [el, rowsAfter(el)],
	},
	{
		match: (el) => el.matches("h2.mt-table-head") && rowsAfter(el) !== null,
		part: "SectionHead",
		slots: () => ({}),
		children: (el) => el,
		asProps: ["display", "align-items", "gap", "margin", "border-bottom", "font-weight", "padding-bottom"],
	},
	{ match: (el) => el.matches("div.mt-table"), part: "ListSectionRows" },
	{
		// A review page's rows (under a group's head) are its own parts.
		// A content language row is its own part (`LanguageLine`, below).
		match: (el) => el.matches("div.mt-row") && !reviewRow(el) && !el.matches(".body > .mt-row"),
		part: "ListSectionRow",
		props: (el) => ({
			metaTone: { faint: "faint", subtle: "subtle", danger: "danger" }[
				/--fg-([a-z]+)/.exec(el.querySelector(".text-meta")?.getAttribute("style") ?? "")?.[1]
			],
			// A key nobody uses yet: its title quiet.
			muted: el.querySelector(".mt-row-title > span[style*='--fg-muted']") ? true : undefined,
		}),
		slots: (el) => ({
			// The row draws its title, its count and its meta line itself: each place takes the words, not the board's element.
			// A title written straight in its element (a name, then a quiet "· role") is all of it; otherwise its first words, its count apart.
			...(ownText(el.querySelector(".mt-row-title"))
				? { title: el.querySelector(".mt-row-title") }
				: {
						title: el.querySelector(".mt-row-title > span:not(.mt-count)"),
						titleCount: el.querySelector(".mt-row-title > .mt-count"),
					}),
			meta: el.querySelector(".text-meta"),
			actions: [...el.querySelectorAll(":scope > .mt-text-btn")],
			control: [el.querySelector(":scope > .mt-select")],
		}),
		asProps: ["position", "grid-template-columns", "align-items", "column-gap", "padding-top", "padding-bottom"],
	},
	// A list: the head row and the rows are neighbours in a board and one table in the design system.
	{
		match: (el) => el.matches(".mt-list-head") && tableAfter(el) !== null,
		part: "List",
		group: (el) => [el, tableAfter(el)],
	},
	{
		match: (el) => el.matches(".mt-list-head"),
		part: "ListHead",
		props: (el) => ({
			columns: [...el.querySelectorAll(".mt-col")]
				.filter((column) => column.closest(".mt-col-wrap")?.style.display !== "none")
				.map((column) => ({
					id: column.textContent.trim(),
					label: column.textContent.trim(),
					...(column.classList.contains("is-sort") ? { sort: "desc" } : {}),
				})),
		}),
		leaf: true,
		asProps: ["grid-template-columns", "column-gap"],
	},
	{
		match: (el) => el.matches(".mt-table") && !headBefore(el),
		part: "ListBody",
		asProps: ["list-style", "margin", "padding"],
	},
	{ match: (el) => el.matches(".mt-table"), part: "TableBody", asProps: ["list-style", "margin", "padding"] },
	{
		match: (el) => el.matches(".mt-row") && !reviewRow(el) && !el.matches(".body > .mt-row"),
		part: "TableRow",
		// Rows 16px above and below are the two-line rows (a title over a line).
		props: (el) => ({ twoLine: el.style.paddingTop === "var(--space-16)" || undefined }),
		asProps: ["grid-template-columns", "column-gap", "align-items", "padding-top", "padding-bottom"],
	},
	{
		match: (el) => el.matches(".mt-row > a:has(> .text-note)"),
		part: "TwoLineTitleCell",
		props: (el) => ({
			title: el.querySelector(".mt-row-title")?.textContent.trim(),
			note: el.querySelector(".text-note")?.textContent.trim(),
		}),
		leaf: true,
		asProps: ["min-width", "text-decoration", "display", "flex-direction", "gap"],
	},
	{
		match: (el) => el.matches(".mt-row > span:has(> .mt-row-title):has(> .mt-row-sub)"),
		part: "TwoLineCell",
		props: (el) => {
			const title = el.querySelector(".mt-row-title");
			return {
				title: [...title.childNodes]
					.filter((node) => !node.classList?.contains("mt-fill"))
					.map((node) => node.textContent)
					.join("")
					.trim(),
				sub: el.querySelector(".mt-row-sub")?.textContent.trim(),
				proposal: title.querySelector(".mt-fill") ? true : undefined,
			};
		},
		leaf: true,
		asProps: ["min-width", "display", "flex-direction", "gap"],
	},
	// A heading over a list's rows (a day's group, "오늘 · 10. 26"): quiet small words, not a heading.
	{
		match: (el) => el.matches(".mt-table-head:is(h2, h3)"),
		part: "Text",
		props: (el) => ({
			as: "p",
			variant: [...el.classList].find((name) => name.startsWith("text-"))?.slice(5),
			tone: "subtle",
		}),
		asProps: ["color"],
	},
	{
		match: (el) => el.matches(".mt-row > span:has(.mt-row-title):has(> .text-note)"),
		part: "TrashTitleCell",
		props: (el) => {
			const meta = el.querySelector(":scope > .text-note");
			return {
				title: el.querySelector(".mt-row-title")?.textContent.trim(),
				address: el.querySelector(".mt-row-sub")?.textContent.trim(),
				meta: meta?.textContent.trim(),
				folder: el.querySelector(":scope > span > span:first-child:not([style*='display: none']) svg")
					? true
					: undefined,
				metaTone: /--fg-warning/.test(meta?.getAttribute("style") ?? "") ? "warning" : undefined,
			};
		},
		leaf: true,
		asProps: ["min-width", "display", "flex-direction", "gap"],
	},
	{
		match: (el) => el.matches(".mt-row > span:has(> .mt-count):has(> .text-meta)"),
		part: "TrashDateCell",
		props: (el) => {
			const left = el.querySelector(".text-meta");
			return {
				date: el.querySelector(".mt-count")?.textContent.trim(),
				left: left?.textContent.trim(),
				urgent: /--fg-warning/.test(left?.getAttribute("style") ?? "") || undefined,
			};
		},
		leaf: true,
		asProps: ["display", "flex-direction", "align-items", "gap"],
	},
	{
		match: (el) => el.matches(".mt-row > span:has(> .mt-text-btn)") && !el.closest(".body"),
		part: "RowButtonsCell",
		asProps: ["display", "align-items", "gap", "justify-content", "min-width"],
	},
	{
		match: (el) => el.matches(".mt-text-btn") && el.textContent.trim() === "⋯" && !el.matches(".mt-row > *"),
		part: "MoreButton",
		leaf: true,
		asProps: ["font-size"],
	},
	// The check a board shows on the row under the pointer is that state's, not the row's.
	{ match: (el) => el.matches(".mt-row > .mt-check:not(.is-on)"), ignore: true },
	{
		match: (el) => el.matches(".mt-row > .mt-check"),
		part: "RowMark",
		props: () => ({ checked: true }),
		leaf: true,
		asProps: ["position", "left", "top", "opacity"],
	},
	{
		// A row's title link; a worded link of the row (its count, going to its entries) is a text button.
		match: (el) => el.matches(".mt-row > a:not(.mt-text-btn)"),
		part: "TitleCell",
		props: (el) => ({
			title: el.querySelector(".mt-row-title")?.textContent.trim(),
			address: el.querySelector(".mt-row-sub")?.textContent.trim(),
			folder: el.classList.contains("mt-row-folder") || undefined,
		}),
		leaf: true,
		asProps: ["order", "min-width", "text-decoration", "display", "align-items", "gap", "overflow", "white-space"],
	},
	{
		match: (el) => el.matches(".mt-row > span.text-note"),
		part: "TableCell",
		props: () => ({ tone: "subtle", truncate: true }),
		asProps: ["order", "color", "white-space", "overflow", "text-overflow", "display", "min-width"],
	},
	{
		match: (el) => el.matches(".mt-row > .mt-count"),
		part: "CountCell",
		props: (el) => ({ align: el.style.textAlign === "right" ? "end" : undefined }),
		asProps: ["order", "white-space", "color", "text-align"],
	},
	{
		match: (el) => el.matches(".mt-row > .mt-text-btn") && el.textContent.trim() === "⋯",
		part: "ActionsCell",
		leaf: true,
		asProps: ["order", "font-size", "justify-self", "opacity"],
	},
	{
		match: (el) => el.matches(".mt-row > span") && !el.closest(".body"),
		part: "TableCell",
		asProps: ["order", "display", "color", "cursor"],
	},
	{
		match: (el) => el.matches(".mt-status"),
		part: "EntryStatus",
		props: (el) => ({
			status:
				["editing", "draft", "archived", "failed"].find((name) => el.classList.contains(`mt-status--${name}`)) ??
				"published",
			quiet: el.classList.contains("mt-status--quiet") || undefined,
		}),
		asProps: ["font-size", "line-height"],
	},
	// A section of a settings or tools page: its title beside (or over) what it holds; the last one has no line under it.
	{
		match: (el) => el.matches(".mt-section"),
		part: "Section",
		props: (el) => ({ last: /^0(px)?$/.test(el.style.borderBottom.split(" ")[0] ?? "") || undefined }),
		asProps: ["border-bottom"],
		slots: (el) => ({ title: el.querySelector(":scope > h2") }),
		// A body that sets its own gap spaces its children itself: the screen's run.
		stacked: true,
		// A body of rows is a list of its own (the content languages); otherwise the body's inside is the section's.
		children: (el) => {
			const body = el.querySelector(":scope > .body") ?? el;
			return body.querySelector(":scope > .mt-row") ? [body] : body;
		},
	},
	{ match: (el) => el.matches(".body:has(> .mt-row)"), part: "LanguageList", asProps: ["gap", "position"] },
	{
		match: (el) => el.matches(".body > .mt-row"),
		part: "LanguageLine",
		props: (el) => {
			const shown = (node) => node && getComputedStyle(node).display !== "none";
			const label = el.querySelector(".mt-row-title ~ .text-note");
			const handle = el.querySelector(":scope > span:first-child > span");
			return {
				name: el.querySelector(".mt-row-title")?.textContent.trim(),
				code: el.querySelector(".mt-row-sub")?.textContent.trim(),
				label: shown(label) ? label.textContent.replace("·", "").trim() : undefined,
				dot: shown(el.querySelector(".mt-change-dot")) ? "changed" : undefined,
				handle: shown(handle) || undefined,
				handled: true,
			};
		},
		children: (el) => {
			const end = el.querySelector(":scope > span:last-child");
			return end?.querySelector(":scope > .text-note") ? [end] : end;
		},
		slots: () => ({}),
		asProps: ["grid-template-columns", "align-items", "column-gap", "display", "justify-content"],
	},
	{
		// The source language's mark: its bold word, the rule, and the button that changes it, one part.
		match: (el) => el.matches(".body .mt-row > span[style*='flex-end']:has(> .text-note)"),
		part: "LanguageSourceMark",
		// Only what the row shows: a translation's row has no flag and no button to change it.
		props: (el) => {
			const flag = el.querySelector(":scope > .text-note");
			return { flag: flag && shown(flag) ? flag.textContent.trim() : undefined };
		},
		slots: () => ({}),
		children: (el) => [...el.querySelectorAll("button")].filter((button) => shown(button)),
		asProps: ["display", "justify-content", "align-items"],
	},
	{ match: (el) => el.matches(".body > .mt-row > span:last-child > .mt-vr"), ignore: true },
	{
		match: (el) => el.matches(".mt-option:not(:has(> .mt-switch, > .mt-radio))"),
		part: "OptionCheck",
		props: (el) => ({
			label:
				[...el.childNodes]
					.filter((node) => node.nodeType === Node.TEXT_NODE)
					.map((node) => node.textContent)
					.join("")
					.trim() || el.querySelector(":scope > .mt-mono")?.textContent.trim(),
			mono: el.querySelector(":scope > .mt-mono") ? true : undefined,
			note: el.querySelector(".text-meta, .text-caption")?.textContent.trim(),
			noteTone: el.querySelector(".text-caption[style*='--fg-warning'], .text-meta[style*='--fg-warning']")
				? "warning"
				: undefined,
			checked: el.querySelector(".mt-check.is-on") ? true : undefined,
		}),
		leaf: true,
		asProps: ["color"],
	},
	{ match: (el) => el.matches(".mt-mono:not(input, textarea)"), part: "Text", props: () => ({ mono: true }) },
	{
		match: (el) => el.matches(".mt-select"),
		part: "SelectBox",
		props: (el) => ({
			value: el.textContent.trim(),
			proposal: el.classList.contains("is-ai") || undefined,
			// At the end of a choice row: as wide as a field needs to read as one.
			width: el.closest(".mt-option") ? "choice" : undefined,
		}),
		leaf: true,
		// An empty select's faint words are its own look.
		asProps: ["width", "min-width", "color"],
	},
	{
		match: (el) => el.matches(".mt-filter"),
		part: "Filter",
		props: (el) => ({ label: el.textContent.trim(), filled: el.classList.contains("is-on") || undefined }),
		leaf: true,
		asProps: ["color"],
	},
	{
		match: (el) => el.matches(".mt-banner"),
		part: "Banner",
		props: (el) => ({
			title: el.querySelector(":scope > b")?.textContent.trim(),
			meta: el.querySelector(":scope > .text-meta")?.textContent.trim(),
			tone: ["danger", "neutral"].find((name) => el.classList.contains(`mt-banner--${name}`)),
		}),
		// The banner's action, at its end.
		slots: () => ({}),
		children: (el) => el,
		asProps: [],
	},
	{ match: (el) => el.matches(".mt-banner > b, .mt-banner > .text-meta, .mt-banner > span:empty"), ignore: true },
	{
		match: (el) => el.matches(".mt-affix"),
		part: "AffixField",
		idOf: (el) => el.querySelector("input")?.id,
		props: (el) => ({
			prefix: el.querySelector(".fix:first-child")?.textContent.trim(),
			suffix: el.querySelector(".fix:last-child:not(:first-child)")?.textContent.trim(),
			value: el.querySelector("input")?.value || undefined,
			placeholder: el.querySelector("input")?.placeholder || undefined,
			proposal: el.querySelector(".is-ai") ? true : undefined,
		}),
		leaf: true,
	},
	// A rule between two groups of a line keeps the room the design system gives it on its sides.
	{ match: (el) => el.matches(".mt-vr"), part: "VerticalRule", leaf: true, asProps: ["align-self", "margin"] },
	{
		match: (el) => el.matches("div:has(> nav.mt-tabs) > span.text-note"),
		part: "Text",
		props: () => ({ variant: "note" }),
		asProps: ["margin-right", "color"],
	},
	{
		match: (el) => el.matches(".mt-textarea"),
		part: "Textarea",
		props: (el) => ({
			value: (el.value ?? el.textContent).trim() || undefined,
			mono: el.classList.contains("mt-mono") || undefined,
			// A height the board gives it is a number of lines.
			rows: el.style.minHeight ? Math.max(1, Math.round((Number.parseFloat(el.style.minHeight) - 12) / 20)) : undefined,
		}),
		leaf: true,
		asProps: ["min-height"],
	},
	// A field's line of help under it, in the role and tone its words have.
	{
		match: (el) => el.matches(".mt-field > span:not([class]):not(:has(input, button)):not(:empty)"),
		part: "Text",
		props: (el) => ({ variant: "label", tone: /var\(--fg-([a-z]+)\)/.exec(el.style.color)?.[1] }),
		asProps: ["color"],
	},
	// A settings screen's save group in its title row: "changes N", "undo all", the pill.
	{
		match: (el) => el.matches(".end > .mt-text-btn:has(> .mt-count--warn)"),
		part: "SaveGroup",
		props: (el) => {
			const buttons = [...el.parentElement.children];
			return {
				label: [...el.childNodes]
					.filter((node) => node.nodeType === Node.TEXT_NODE)
					.map((node) => node.textContent)
					.join("")
					.trim(),
				count: Number(el.querySelector(".mt-count")?.textContent.trim()),
				proposalsLabel:
					[...(el.querySelector(".mt-fill")?.childNodes ?? [])]
						.filter((node) => node.nodeType === Node.TEXT_NODE)
						.map((node) => node.textContent)
						.join("")
						.trim() || undefined,
				proposalsCount: Number(el.querySelector(".mt-count--proposal")?.textContent.trim()) || undefined,
				discardLabel: buttons.find((button) => button !== el && button.matches(".mt-text-btn"))?.textContent.trim(),
				saveLabel: buttons.find((button) => button.matches(".mt-btn"))?.textContent.trim(),
				saveDisabled: buttons.some((button) => button.matches(".mt-btn.is-disabled")) || undefined,
			};
		},
		leaf: true,
	},
	{
		match: (el) => el.matches(".end:has(> .mt-text-btn > .mt-count--warn) > :not(.mt-text-btn:has(> .mt-count--warn))"),
		ignore: true,
	},
	// A field's label row with the assistant's proposal: a blue dot and the button that discards it.
	{
		match: (el) => el.matches(".mt-label-row:has(> .mt-proposal-dot)"),
		part: "ChangedLabel",
		props: (el) => ({
			label: el.querySelector(".mt-label")?.textContent.trim(),
			undo: el.querySelector(".mt-text-btn")?.textContent.trim(),
			proposal: true,
			for: el.querySelector(".mt-label")?.getAttribute("for"),
		}),
		leaf: true,
	},
	// The saved value a proposal would replace, struck through under the field.
	{
		match: (el) => el.matches(".mt-field > .mt-del"),
		part: "Was",
		props: (el) => ({ text: el.textContent.trim() }),
		leaf: true,
		asProps: ["padding-top"],
	},
	// A field's label with the dot of a change and its undo.
	{
		match: (el) => el.matches(".mt-label:has(> .mt-change-dot)"),
		part: "ChangedLabel",
		props: (el) => ({
			label: [...el.childNodes]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent)
				.join("")
				.trim(),
			undo: el.querySelector(".mt-text-btn")?.textContent.trim(),
			for: el.getAttribute("for"),
		}),
		leaf: true,
		asProps: ["display", "align-items", "gap"],
	},
	// A sheet over the screen: the dim behind it is the sheet's own.
	{ match: (el) => el.matches(".mt-backdrop"), ignore: true },
	// A group's subheading is read by its group.
	{ match: (el) => el.matches("h3.mt-props-title"), ignore: true },
	{
		match: (el) => el.matches("section.mt-sheet"),
		part: "Sheet",
		overlay: true,
		props: (el) => {
			const title = el.querySelector(".mt-panel-head > h2");
			return {
				title: [...(title?.childNodes ?? [])]
					.filter((node) => node.nodeType === Node.TEXT_NODE)
					.map((node) => node.textContent)
					.join("")
					.trim(),
				of: title?.querySelector(".text-meta")?.textContent.replace(/^·\s*/, "").trim(),
			};
		},
		slots: (el) => ({ footer: el.querySelector(":scope > .mt-panel-foot") }),
		children: (el) => [...el.children].filter((child) => !child.matches("header, footer")),
		asProps: ["position", "z-index", "top", "right", "height", "width"],
	},
	{
		match: (el) => el.matches(".mt-sheet .mt-panel-body"),
		part: "SheetBody",
		props: (el) => ({ blocks: el.style.paddingTop.includes("--space-4") || undefined }),
		stacked: true,
		asProps: ["flex", "overflow", "padding-top", "gap"],
	},
	{
		match: (el) => el.matches(".mt-sheet > div:has(> [role=listbox])"),
		part: "SheetSplit",
		slots: (el) => ({ list: el.querySelector(":scope > [role=listbox]") }),
		children: (el) => [...el.children].filter((child) => !child.matches("[role=listbox]")),
		asProps: ["flex", "display", "min-height"],
	},
	// What the sheet will make, at the end of its body.
	{
		match: (el) => el.matches(".mt-sheet .mt-panel-body > div[style*='--bg-tool']"),
		part: "SheetSummary",
		props: (el) => ({ text: el.textContent.trim() }),
		leaf: true,
		asProps: ["padding", "background", "border-radius"],
	},
	// The kinds to pick from, on the left of a split sheet.
	{
		match: (el) => el.matches("[role=listbox]:has(> .mt-menu-item)"),
		part: "KindList",
		props: (el) => ({ label: el.getAttribute("aria-label") }),
		asProps: ["flex", "padding", "border-right", "display", "flex-direction"],
	},
	{
		match: (el) => el.matches("[role=listbox] > .mt-menu-item"),
		part: "KindItem",
		props: (el) => ({
			label: [...el.childNodes]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent)
				.join("")
				.trim(),
			selected: el.classList.contains("is-on") || undefined,
			mark: el.querySelector(".k")?.textContent.trim(),
		}),
		leaf: true,
	},
	// A pane's tab row.
	{
		match: (el) => el.matches(".mt-tabs--bar"),
		part: "PaneTabs",
		props: (el) => ({ open: el.querySelector("[aria-selected=true]")?.textContent.trim() }),
		asProps: ["flex-grow"],
	},
	{
		match: (el) => el.matches(".mt-tabs--bar > [role=tab]"),
		part: "PaneTab",
		props: (el) => ({ label: el.textContent.trim() }),
		leaf: true,
	},
	// One among a few, joined in a frame.
	{
		match: (el) => el.matches(".mt-field > .mt-seg, .mt-seg.mt-seg--sm:not(.mt-sidebar-foot > *)"),
		part: "SegmentedChoice",
		props: (el) => {
			const cells = [...el.children].map((cell) => cell.textContent.trim());
			return {
				label:
					el.getAttribute("aria-label") ?? el.parentElement.querySelector(":scope > .mt-label")?.textContent.trim(),
				options: cells.map((cell) => ({ value: cell, label: cell })),
				picked: [...el.children].find((cell) => cell.classList.contains("is-on"))?.textContent.trim(),
				size: el.classList.contains("mt-seg--sm") ? "sm" : undefined,
				inline: el.classList.contains("mt-seg--inline") || undefined,
			};
		},
		leaf: true,
		asProps: ["margin-top"],
	},
	// Rows of options with a round mark each.
	{
		match: (el) => el.matches("[role=radiogroup]"),
		part: "Choices",
		props: (el) => {
			const picked = el.querySelector(".mt-radio.is-on")?.closest(".mt-option");
			return { label: el.getAttribute("aria-label"), picked: picked && choiceLabel(picked) };
		},
		slots: () => ({}),
		children: (el) => [...el.querySelectorAll(":scope > .mt-option")],
		// The note under the options is the change's (its next line), not the choice's.
		leaves: ":scope > p.note",
		asProps: ["display", "flex-direction", "gap", "padding-top"],
	},
	{
		match: (el) => el.matches(".mt-option:has(> .mt-radio)"),
		part: "Choice",
		props: (el) => ({
			label: choiceLabel(el),
			description: el.querySelector(":scope > .text-meta")?.textContent.trim(),
			hint: el.querySelector(":scope > .n")?.textContent.trim(),
		}),
		slots: (el) => ({ control: [el.querySelector(":scope > .mt-select")] }),
		children: () => [],
		asProps: ["color"],
	},
	// One change of a schema review.
	{
		match: (el) => el.matches("section.mt-change"),
		part: "Change",
		props: (el) => ({
			kind: ["new", "edit", "drop"].find((kind) => el.classList.contains(`mt-change--${kind}`)),
			tag: el.querySelector(":scope > .tag")?.textContent.trim(),
			title: el.querySelector(":scope > .head > b")?.textContent.trim(),
			identifier: el.querySelector(":scope > .head > .key")?.textContent.trim(),
		}),
		slots: () => ({}),
		// A body of options is one choice, and its note follows it; any other body is its own lines.
		children: (el) => {
			const body = el.querySelector(":scope > .body");
			if (!body) return [];
			return body.matches("[role=radiogroup]")
				? [body, ...body.querySelectorAll(":scope > p.note")]
				: [...body.children];
		},
	},
	{
		match: (el) => el.matches(".mt-change p.note"),
		part: "ChangeResult",
		props: (el) => ({ text: el.textContent.trim(), danger: el.classList.contains("is-danger") || undefined }),
		leaf: true,
	},
	{
		match: (el) => el.matches(".mt-change p.lines"),
		part: "ChangeRows",
		slots: () => ({}),
		children: (el) => [...el.querySelectorAll(":scope > .what")],
	},
	{
		match: (el) => el.matches(".mt-change p.lines > .what"),
		part: "ChangeRow",
		props: (el) => ({ what: el.textContent.trim(), result: el.nextElementSibling?.textContent.trim() }),
		leaf: true,
	},
	// The folders above the open one, in a page header.
	{
		match: (el) =>
			el.matches("nav[aria-label]") &&
			getComputedStyle(el).display === "flex" &&
			el.querySelector(":scope > .mt-text-btn") !== null,
		part: "Trail",
		props: (el) => ({ label: el.getAttribute("aria-label") }),
		asProps: ["display", "align-items", "gap", "color"],
	},
	{
		match: (el) => el.matches("nav[aria-label] > span[aria-hidden]") && el.textContent.trim() === "/",
		part: "TrailSlash",
		leaf: true,
	},
	// A quiet word after a row's title (a plugin key's role).
	{
		match: (el) => el.matches(".mt-row-title > span") && el.style.color.includes("--fg-muted"),
		part: "Text",
		props: () => ({ as: "span", tone: "muted" }),
		asProps: ["color", "font-weight"],
	},
	// A review of the assistant's proposal: the request, each group's head, its changes.
	{
		match: (el) =>
			el.matches("main p") && el.style.fontSize === "16px" && el.nextElementSibling?.matches("h2.mt-toolbar"),
		part: "ReviewAsk",
		props: (el) => ({ text: el.textContent.trim() }),
		leaf: true,
		asProps: ["font-size", "color", "line-height"],
	},
	{
		match: (el) => el.matches("h2.mt-toolbar"),
		part: "ReviewHead",
		props: (el) => ({
			title: [...el.childNodes]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent)
				.join("")
				.trim(),
			meta: el.querySelector(":scope > .text-meta")?.textContent.trim(),
		}),
		slots: (el) => ({ actions: el.querySelector(":scope > .end") }),
		children: () => [],
		asProps: ["min-height", "gap", "align-items", "padding-bottom", "font-size", "font-weight"],
	},
	{
		match: (el) => el.matches("h2.mt-toolbar > .end .mt-vr"),
		part: "VerticalRule",
		leaf: true,
		asProps: ["align-self"],
	},
	{
		match: (el) => el.matches(".mt-review-line"),
		part: "ReviewBlockLine",
		props: (el) => ({
			label: [...(el.querySelector(".gut > .name")?.childNodes ?? [])]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent)
				.join("")
				.trim(),
			note: el.querySelector(".gut .note")?.textContent.trim(),
			text: markedRun(el.querySelector(":scope > .text")),
			included: el.querySelector(".mt-check.is-on") ? true : undefined,
		}),
		leaf: true,
	},
	{
		match: (el) => el.matches(".mt-row[style*='104px']") && el.querySelector(":scope > span:empty") !== null,
		part: "ReviewColumns",
		props: (el) => {
			const [before, after] = [...el.querySelectorAll(":scope > .text-micro")].map((cell) => cell.textContent.trim());
			return { before, after };
		},
		leaf: true,
		asProps: ["grid-template-columns", "column-gap", "align-items", "padding", "margin", "border-bottom"],
	},
	{
		match: (el) => el.matches(".mt-row[style*='104px']"),
		part: "ReviewBlockCompare",
		props: (el) => {
			const [before, after] = [...el.querySelectorAll(":scope > .cell")];
			return {
				label: [
					...(el.querySelector(".gut")?.querySelectorAll(":scope > span:not(.mt-check)") ?? []),
				][0]?.textContent.trim(),
				note: el.querySelector(".gut .note")?.textContent.trim(),
				before: markedRun(before),
				after: markedRun(after),
				included: el.querySelector(".mt-check.is-on") ? true : undefined,
			};
		},
		leaf: true,
		asProps: ["grid-template-columns", "column-gap", "align-items", "padding", "margin", "border-bottom"],
	},
	{
		match: (el) => el.matches(".mt-row:has(> .mt-check)") && el.closest("main") !== null && !el.closest(".mt-table"),
		part: "ReviewEntry",
		props: (el) => {
			const what = el.querySelector(":scope > span:not(.mt-check):not(.mt-count)");
			const head = what?.querySelector(":scope > span[style*='baseline']") ?? what;
			const titleEl = head?.querySelector("span[style*='font-weight: 600']");
			const lines = what?.querySelectorAll(":scope > span") ?? [];
			const change = what?.style.flexDirection === "column" ? lines[lines.length - 1] : undefined;
			const end =
				el.querySelector(":scope > .mt-count") ?? head?.querySelector(":scope > .text-micro, :scope > .text-caption");
			return {
				title: titleEl
					? titleEl.textContent.trim()
					: [...(what?.childNodes ?? [])]
							.filter((node) => node.nodeType === Node.TEXT_NODE)
							.map((node) => node.textContent)
							.join("")
							.trim(),
				path: head?.querySelector(".mt-row-sub")?.textContent.trim(),
				end: end?.textContent.trim() || undefined,
				again: head?.querySelector(":scope > .mt-text-btn")?.textContent.trim(),
				change: markedRun(change),
				included: el.querySelector(":scope > .mt-check.is-on") ? true : undefined,
				muted: change?.style.color?.includes("--fg-subtle") || undefined,
			};
		},
		leaf: true,
		asProps: ["grid-template-columns", "column-gap", "align-items"],
	},
	{
		match: (el) =>
			el.matches("main .mt-text-btn--quiet:has(> .mt-caret)") && el.previousElementSibling?.matches(".mt-row"),
		part: "ReviewRest",
		props: (el) => ({ label: el.textContent.trim() }),
		leaf: true,
		asProps: ["margin-top", "margin-left"],
	},
	// An editor: its head, the entry's title and the rule under it, the body, the bar under it all.
	{
		match: (el) => el.matches("header:not([class])") && el.style.height === "var(--height-header)",
		part: "EditorTopBar",
		slots: (el) => {
			const parts = [...el.children];
			const spacer = parts.findIndex((child) => child.matches("span:empty") && child.style.flexGrow === "1");
			return { start: parts.slice(0, spacer), end: parts.slice(spacer + 1) };
		},
		children: () => [],
		asProps: ["height", "flex-shrink", "display", "align-items", "gap", "padding", "border-bottom", "flex-wrap"],
	},
	{
		match: (el) => el.matches(".mt-split"),
		part: "PublishButton",
		props: (el) => ({
			label: el.querySelector(":scope > button:first-child")?.textContent.trim(),
			menuLabel: el.querySelector(":scope > button[aria-label]")?.getAttribute("aria-label"),
		}),
		leaf: true,
		asProps: ["opacity"],
	},
	{
		match: (el) => el.matches("main h1.text-display"),
		part: "EntryTitle",
		props: (el) => ({ text: el.textContent.trim(), faint: el.style.color.includes("--fg-faint") || undefined }),
		leaf: true,
		asProps: ["color"],
	},
	{
		match: (el) => el.matches("div:empty") && el.style.borderTop.includes("--border-contrast"),
		part: "TitleRule",
		leaf: true,
		asProps: ["border-top"],
	},
	{
		match: (el) => el.matches("input.text-display"),
		part: "TitleInput",
		idOf: (el) => el.id,
		props: (el) => ({ value: el.value, placeholder: el.placeholder, label: el.getAttribute("aria-label") }),
		leaf: true,
		asProps: ["display", "width", "margin", "border", "background", "padding", "color", "outline"],
	},
	// The design system's buttons show no shortcut: the one a board writes in a button is left out.
	{ match: (el) => el.matches(".mt-btn > .text-micro"), ignore: true },
	// The source beside a translation: its quiet line, its title and rule, its body (muted, read only).
	{
		match: (el) => el.matches("aside.mt-tool"),
		part: "SourceColumn",
		props: (el) => ({
			label: el.querySelector(".text-meta")?.textContent.trim(),
			title: el.querySelector("h1")?.textContent.trim(),
		}),
		slots: () => ({}),
		children: (el) => [el.querySelector(".text-reading")],
		asProps: ["flex", "min-width", "border-right"],
	},
	// The line over a translation's title: its language tabs and the assistant's action for the entry.
	{
		match: (el) => el.matches("div:has(> nav.mt-tabs[aria-label])") && el.style.height === "32px",
		part: "LanguageBar",
		slots: (el) => ({
			tabs: [el.querySelector(":scope > nav.mt-tabs")],
			action: [...el.children].filter((child) => !child.matches("nav")),
		}),
		children: () => [],
		asProps: ["display", "align-items", "height"],
	},
	// The library as a picker over the screen: the dim behind it is the picker's own.
	{
		match: (el) =>
			el.matches("div:has(> section.mt-dialog nav[aria-label] > .mt-nav)") &&
			getComputedStyle(el).position === "absolute",
		part: "PickerDialog",
		overlay: true,
		// It draws its own words (the step count, cancel).
		ownWords: true,
		props: (el) => {
			const dialog = el.querySelector("section.mt-dialog");
			const nav = dialog.querySelector("nav[aria-label]");
			const links = [...nav.querySelectorAll(":scope > .mt-nav")];
			const name = (link) =>
				[...link.childNodes]
					.filter((node) => node.nodeType === Node.TEXT_NODE || node.classList?.contains("sc-interp"))
					.map((node) => node.textContent)
					.join("")
					.trim();
			const [all, ...rest] = links;
			const picked = links.find((link) => link.classList.contains("is-on"));
			const buttons = [...dialog.querySelectorAll(".mt-dialog-actions > button")];
			return {
				title: dialog.querySelector(".mt-dialog-title")?.textContent.trim(),
				allLabel: all && name(all),
				folders: rest.map((link) => ({
					id: name(link),
					name: name(link),
					depth: Number.parseFloat(link.style.paddingLeft) > 0 ? 1 : 0,
					count: Number(link.querySelector(".n")?.textContent.trim()) || undefined,
				})),
				folder: picked && picked !== all ? name(picked) : undefined,
				foldersLabel: nav.getAttribute("aria-label"),
				searchLabel: dialog.querySelector("input")?.getAttribute("placeholder"),
				uploadLabel: buttons[0]?.textContent.trim(),
				confirmLabel: buttons[buttons.length - 1]?.textContent.trim(),
			};
		},
		slots: () => ({}),
		children: (el) => [...el.querySelectorAll(".mt-tile")],
		asProps: ["position", "inset", "z-index", "display", "align-items", "justify-content"],
	},
	// A translation beside its source, block by block.
	{
		match: (el) => el.matches("div:has(> .mt-pair)"),
		part: "PairRows",
		slots: () => ({}),
		children: (el) => [...el.querySelectorAll(":scope > .mt-pair")],
		asProps: ["max-width", "margin"],
	},
	{
		match: (el) => el.matches(".mt-pair"),
		part: "PairRow",
		props: (el) => {
			const gutter = el.querySelector(":scope > .gutter");
			const marks = gutter ? [...gutter.querySelectorAll(":scope > span")] : [];
			const note = marks.find((mark) => mark.matches(".is-changed, .is-new"));
			const sub = marks.find((mark) => mark !== note);
			const src = el.querySelector(":scope > .src");
			const dst = el.querySelector(":scope > .dst");
			// Each block of a side: a new piece per paragraph, list item or row; the marked words of the source as changed pieces.
			// A side's blocks, as the data gives them: each starts with a piece that has its `kind`; the pieces after it go on the same block.
			const runOf = (block, kind, extra = {}) => {
				const runs = [...block.childNodes]
					.filter((node) => node.textContent.trim() !== "" && node.nodeName !== "BUTTON")
					.map((node) => ({ text: node.textContent, changed: node.nodeName === "MARK" || undefined }));
				return runs.map((run, index) => (index === 0 ? { kind, ...run, ...extra } : run));
			};
			const pieces = (side) => {
				if (!side) return undefined;
				const out = [];
				const faint = (node) => node.matches(".mt-untranslated, [style*='--fg-faint']") || undefined;
				for (const block of side.querySelectorAll(":scope > *, :scope > .mt-shared > *")) {
					if (block.matches("button")) continue;
					if (block.matches(".mt-shared")) continue;
					if (block.matches(".mt-doc-callout")) {
						for (const [index, line] of [...block.children].entries())
							out.push(...runOf(line, index === 0 ? "callout" : "line"));
					} else if (block.matches("pre")) {
						out.push({ kind: "code", text: block.textContent, faint: faint(block) });
					} else if (block.matches("table")) {
						for (const row of block.querySelectorAll("tr"))
							out.push({
								kind: row.querySelector("th") ? "th" : "tr",
								text: [...row.children].map((cell) => cell.textContent.trim()).join("\t"),
							});
					} else if (block.matches("ul, ol")) {
						for (const item of block.querySelectorAll(":scope > li")) out.push(...runOf(item, "li"));
					} else if (block.querySelector(".mt-field")) {
						const picture = block.querySelector(":scope > div:first-child");
						out.push({
							kind: "image",
							text: "",
							picture: picture?.style.background,
							faint: picture?.style.opacity ? true : undefined,
						});
						for (const field of block.querySelectorAll(".mt-field")) {
							const input = field.querySelector("input");
							out.push({
								kind: "field",
								label: field.querySelector(".mt-label")?.textContent.trim(),
								text: input ? input.value : (field.querySelector("p")?.textContent.trim() ?? ""),
								placeholder: input?.placeholder || undefined,
								editable: input ? true : undefined,
							});
						}
					} else if (block.matches("h1")) {
						out.push({ kind: "title", text: block.textContent.trim() });
					} else {
						out.push(...runOf(block, "p", { faint: faint(block) }));
					}
				}
				return out;
			};
			const head = el.classList.contains("mt-pair--head");
			const title = el.classList.contains("mt-pair--title");
			const shared = dst?.querySelector(".mt-shared");
			return {
				kind: head ? "head" : title ? "title" : undefined,
				name: gutter
					? [...gutter.childNodes]
							.filter((node) => node.nodeType === Node.TEXT_NODE)
							.map((node) => node.textContent)
							.join("")
							.trim()
					: undefined,
				sub: sub?.textContent.trim(),
				note: note?.textContent.trim(),
				current: dst?.classList.contains("is-on") || undefined,
				sourceLabel: head ? src?.textContent.trim() : undefined,
				translationLabel: head ? dst?.textContent.trim() : undefined,
				source: head ? undefined : pieces(src),
				translation: head ? undefined : pieces(dst),
				shared: shared ? true : undefined,
				sharedAction: shared?.querySelector("button")?.textContent.trim(),
			};
		},
		leaf: true,
	},
	// The line under a pane's tabs: the source view's switch, named by the quiet word before it.
	{
		match: (el) => el.matches("div:has(> .mt-seg--sm)") && el.style.height === "var(--height-panebar)",
		part: "PaneLine",
		slots: () => ({}),
		children: (el) => [...el.children],
		asProps: ["height", "flex-shrink", "display", "align-items", "gap", "padding", "border-bottom"],
	},
	// Two versions side by side.
	{ match: (el) => el.matches(".mt-compare"), part: "CompareView", asProps: ["flex-grow"] },
	{
		match: (el) => el.matches(".mt-compare > section"),
		part: "CompareColumn",
		props: (el) => {
			const pieces = (block) =>
				[...block.childNodes]
					.map((node) => ({ text: node.textContent, changed: node.nodeName === "MARK" || undefined }))
					.filter((piece) => piece.text.trim() !== "");
			const doc = [...el.querySelectorAll(".text-reading > :is(h2, h3, p)")].flatMap((block) =>
				pieces(block).map((piece, index) => (index === 0 ? { kind: block.tagName.toLowerCase(), ...piece } : piece)),
			);
			const properties = [...el.querySelectorAll(".props > .mt-label")].map((name) => {
				const value = name.nextElementSibling;
				const empty = value?.style.color.includes("--fg-faint");
				return {
					label: name.textContent.trim(),
					text: empty ? undefined : value?.textContent.trim(),
					changed: value?.querySelector("mark") ? true : undefined,
				};
			});
			const emptyWord = el.querySelector(".props > .mt-label + [style*='--fg-faint']")?.textContent.trim();
			return {
				label: el.getAttribute("aria-label"),
				empty: emptyWord,
				properties,
				title: el.querySelector("article > h1")?.textContent.trim(),
				doc,
			};
		},
		leaf: true,
	},
	// The pill over the status bar while proposals wait: it opens over the editor.
	{
		match: (el) => el.matches("div[role=toolbar]:has(> .mt-bubble)"),
		part: "ProposalDock",
		overlay: true,
		// It draws its own words (the step count, cancel).
		ownWords: true,
		props: (el) => {
			const bubble = el.querySelector(".mt-bubble");
			const [position, total] = (bubble.querySelector(".mt-count")?.textContent ?? "")
				.split("/")
				.map((n) => Number(n.trim()));
			const buttons = [...bubble.querySelectorAll("button")];
			return {
				name: bubble.querySelector(".who")?.textContent.trim(),
				position: position || undefined,
				total: total || undefined,
				previousLabel: buttons[0]?.getAttribute("aria-label"),
				nextLabel: buttons[1]?.getAttribute("aria-label"),
				discardAllLabel: bubble.querySelector(".mt-text-btn")?.textContent.trim(),
				acceptAllLabel: bubble.querySelector(".mt-btn")?.textContent.trim(),
			};
		},
		leaf: true,
		asProps: ["position", "left", "right", "bottom", "z-index", "display", "justify-content", "pointer-events"],
	},
	{
		match: (el) => el.matches(".text-reading"),
		part: "EditorBody",
		// The editor's own tools in the body (a block's handle and menu, a proposal's mark and its card) and its line that asks for the first block
		// are its states, not the body's.
		leaves: `${EDITOR_TOOLS}, p[style*='--fg-faint']`,
		props: (el) => ({ doc: bodyBlocks(el), muted: el.closest(".mt-tool") ? true : undefined }),
		leaf: true,
		asProps: ["color"],
	},
	{
		match: (el) => el.matches("footer.mt-statusbar"),
		part: "EditorStatusBar",
		props: (el) => ({ label: el.getAttribute("aria-label") }),
		slots: () => ({}),
		children: (el) => [
			...el.querySelectorAll(
				":scope > button, :scope > .cell:not(:has(.mt-statusbar-list)) > button, :scope > .cell:has(.mt-statusbar-list), :scope > span:not(.cell), :scope > .grow, :scope > .end",
			),
		],
	},
	{ match: (el) => el.matches(".mt-statusbar > .grow"), part: "StatusGap", leaf: true },
	// A cell whose list is open.
	{
		match: (el) => el.matches(".mt-statusbar > .cell:has(.mt-statusbar-list)"),
		part: "StatusListCell",
		props: (el) => {
			const list = el.querySelector(".mt-statusbar-list");
			const head = [...(list.querySelector(".mt-menu-label")?.children ?? [])];
			const button = el.querySelector(":scope > button");
			return {
				label: button?.textContent.replace(/\s+/g, " ").trim(),
				tone: button?.querySelector(".warn, [style*='--fg-warning']") ? "warning" : undefined,
				listLabel: head[0]?.textContent.trim(),
				count: Number(head[1]?.textContent.trim()) || undefined,
				items: [...list.querySelectorAll(".mt-todo-item")].map((item) => ({
					title: item.querySelector(".title")?.textContent.trim(),
					detail: item.querySelector(".sub")?.textContent.trim(),
					action: item.querySelector(".act")?.textContent.trim() || undefined,
					ai: item.querySelector(".act:not(.plain)") ? true : undefined,
					current: item.classList.contains("is-on") || undefined,
				})),
				done: [...list.querySelectorAll(".mt-todo-done")].map((row) => ({
					text: [...row.childNodes]
						.filter((node) => node.nodeType === Node.TEXT_NODE || node.classList?.contains("sc-interp"))
						.map((node) => node.textContent)
						.join("")
						.trim(),
				})),
			};
		},
		slots: (el) => ({ footer: el.querySelector(".mt-statusbar-list > div:last-child:has(> .mt-text-btn)") }),
		children: () => [],
	},
	{
		match: (el) =>
			el.matches(".mt-statusbar > button, .mt-statusbar > .cell > button, .mt-statusbar > span:not(.cell, .grow)"),
		part: "StatusCell",
		props: (el) => {
			const warn =
				el.matches(".warn") ||
				el.querySelector(".warn") !== null ||
				el.querySelector("[style*='--fg-warning']") !== null;
			return {
				label: el.textContent.replace(/\s+/g, " ").trim(),
				tone: warn
					? "warning"
					: el.matches(".danger, [style*='--fg-danger']") || el.querySelector(".danger")
						? "danger"
						: undefined,
				end: el.matches(".end") || undefined,
			};
		},
		leaf: true,
		asProps: ["color"],
	},
	// A library's files and folders, where files can be dropped.
	{
		match: (el) => el.matches(".mt-droparea"),
		part: "DropZone",
		props: (el) => ({ over: el.classList.contains("is-over") || undefined }),
	},
	{
		match: (el) => el.matches(".mt-tiles"),
		part: "MediaGrid",
		props: (el) => ({ folders: el.classList.contains("mt-tiles--folders") || undefined }),
		asProps: ["position"],
	},
	{
		match: (el) => el.matches(".mt-tile"),
		part: "MediaTile",
		props: (el) => {
			const img = el.querySelector(":scope > .img");
			const bar = img?.querySelector(".mt-progress > span");
			const failed = el.classList.contains("is-failed");
			// A picture the board fills with a colour: what the data gives in its place.
			const fill =
				img &&
				[img, ...img.querySelectorAll(":scope > span")]
					.map((node) => node.style.background)
					.find((paint) => paint.includes("gradient"));
			return {
				name: el.querySelector(".name")?.textContent.trim(),
				detail: el.querySelector(".meta")?.textContent.trim(),
				ext: img?.querySelector(".ext")?.textContent.trim(),
				picture: !img?.classList.contains("is-file") && fill ? fill : undefined,
				status: failed ? (img?.style.background || fill ? "interrupted" : "failed") : bar ? "uploading" : undefined,
				progress: bar ? Number.parseFloat(bar.style.width) : undefined,
				actions: failed
					? [...el.querySelectorAll(".acts > .mt-text-btn")].map((button) => ({ label: button.textContent.trim() }))
					: undefined,
				selected: el.querySelector(".mt-check.is-on") ? true : undefined,
			};
		},
		leaf: true,
		asProps: ["margin", "position", "z-index"],
	},
	{
		match: (el) => el.matches(".mt-folder"),
		part: "FolderEntry",
		props: (el) => {
			const count = el.querySelector(".mt-count")?.textContent.trim();
			return {
				name: el.querySelector("span:not(.mt-count)")?.textContent.trim(),
				count: count ? Number(count) : undefined,
				up: count === undefined || undefined,
				selected: el.classList.contains("is-on") || undefined,
			};
		},
		leaf: true,
		asProps: ["text-decoration", "color", "background"],
	},
	// The editor's properties pane: its tab bar over the picked tab's groups of rows.
	{
		match: (el) => el.matches("aside.mt-panel:has(> nav.mt-tabs--bar):not(:has(> .mt-panel-head))"),
		part: "PropsPanel",
		props: (el) => {
			const tabs = [...el.querySelectorAll(":scope > nav [role=tab]")].map((tab) => ({
				value: tab.textContent.trim(),
				label: tab.textContent.trim(),
			}));
			return {
				label: el.getAttribute("aria-label"),
				open: el.querySelector(":scope > nav [role=tab][aria-selected=true], :scope > nav .is-on")?.textContent.trim(),
				tabs,
			};
		},
		slots: () => ({}),
		// The picked tab's page: its groups, each with the subheading before it.
		children: (el) => [...el.querySelectorAll(":scope > div > .mt-props")].filter((group) => shown(group)),
		asProps: ["flex", "max-width", "min-width"],
	},
	{
		match: (el) => el.matches(".mt-props"),
		part: "PropsGroup",
		props: (el) => ({
			title: el.previousElementSibling?.matches("h3.mt-props-title")
				? el.previousElementSibling.textContent.trim()
				: undefined,
		}),
	},
	{
		match: (el) => el.matches(".mt-label-row:has(> .mt-ai-action)"),
		part: "LabelWithFill",
		props: (el) => ({
			label: el.querySelector(".mt-label")?.textContent.trim(),
			action: el.querySelector(".mt-ai-action")?.textContent.trim(),
			for: el.querySelector(".mt-label")?.getAttribute("for"),
		}),
		leaf: true,
	},
	{
		match: (el) => el.matches(".mt-input-line, .mt-affix.is-bare"),
		part: "LineInput",
		idOf: (el) => el.querySelector("input, textarea")?.id,
		props: (el) => {
			const input = el.querySelector("input, textarea");
			const button = el.querySelector(".mt-icon-btn");
			return {
				value: input?.value || undefined,
				placeholder: input?.placeholder || undefined,
				mono: input?.classList.contains("mt-mono") || undefined,
				multiline: el.classList.contains("mt-input-line--multi") || undefined,
				actionLabel: button?.getAttribute("aria-label"),
				actionIcon: button?.querySelector("svg") ? iconName(button.querySelector("svg")) : undefined,
			};
		},
		leaf: true,
	},
	{
		match: (el) => el.matches(".mt-chips-field"),
		part: "ChipsField",
		idOf: (el) => el.closest(".mt-field")?.querySelector("label")?.getAttribute("for"),
		props: (el) => ({
			label: el.closest(".mt-field")?.querySelector(".mt-label")?.textContent.trim(),
			items: [...el.querySelectorAll(".mt-chip")].map((chip) => ({
				label: [...chip.childNodes]
					.filter((node) => node.nodeType === Node.TEXT_NODE)
					.map((node) => node.textContent)
					.join("")
					.trim(),
			})),
			removeLabel: el.querySelector(".mt-chip .x")?.getAttribute("aria-label")?.split(" ").slice(1).join(" "),
		}),
		leaf: true,
		// Each chip's × is the part's.
		ownWords: true,
	},
	{
		match: (el) => el.matches(".mt-field > span:empty") && el.style.background.includes("gradient"),
		part: "PropertyPicture",
		props: (el) => ({ picture: el.style.background }),
		leaf: true,
		asProps: ["display", "height", "border-radius", "background", "margin"],
	},
	// A conversation: the turns are the data; the proposals in it are parts.
	{
		match: (el) => el.matches("div:has(> div > .mt-msg-user)"),
		part: "Conversation",
		props: (el) => {
			const turns = [];
			const words = (node) => node.textContent.replace(/\s+/g, " ").trim();
			for (const item of el.querySelector(":scope > div:has(> .mt-msg-user)").children) {
				if (item.matches(".mt-msg-user")) {
					turns.push({ role: "user", text: words(item) });
					continue;
				}
				for (const line of item.querySelectorAll(".mt-tool-line")) turns.push({ role: "tool", text: words(line) });
				for (const said of item.querySelectorAll(":scope > p")) turns.push({ role: "assistant", text: words(said) });
				for (const entry of item.querySelectorAll(".mt-entry-list > li"))
					turns.push({
						role: "entry",
						text: words(entry.querySelector("a")),
						detail: entry.querySelector(".slug")?.textContent.trim(),
					});
			}
			return { turns };
		},
		slots: () => ({}),
		children: (el) => [...el.querySelectorAll("section.mt-card[aria-label]")],
		asProps: ["flex", "min-height", "overflow", "display", "flex-direction"],
	},
	{
		match: (el) => el.matches("section.mt-card:has(> .mt-proposal-entry)"),
		part: "ProposalBox",
		props: (el) => {
			const head = el.querySelector(":scope > div:first-child");
			const foot = [...el.querySelectorAll(":scope > div:has(> .mt-btn)")].find((row) => shown(row));
			return {
				title: head?.querySelector("b")?.textContent.trim(),
				summary: head?.querySelector(".text-micro")?.textContent.trim(),
				status: head?.querySelector(".text-caption")?.textContent.trim() || undefined,
				entries: [...el.querySelectorAll(".mt-proposal-entry")].map((entry) => ({
					name: entry.querySelector(".name")?.textContent.trim(),
					slug: entry.querySelector(".slug")?.textContent.trim(),
					field: entry.querySelector(".field")?.textContent.trim(),
					text: entry.querySelector("ins")?.textContent.trim(),
				})),
				reviewLabel: foot?.querySelector(".mt-text-btn--underline")?.textContent.trim(),
				discardLabel: foot?.querySelector(".mt-text-btn--quiet")?.textContent.trim(),
				applyLabel: foot?.querySelector(".mt-btn")?.textContent.trim(),
			};
		},
		leaf: true,
		asProps: ["padding", "overflow", "box-shadow", "border-color"],
	},
	// The assistant's empty panel: requests to start from, and the box to type in.
	{
		// The panel's scrolling body with the requests at its bottom: the list fills the panel and sits low itself.
		match: (el) => el.matches("div:has(> div > .mt-suggest)"),
		part: "Suggestions",
		slots: () => ({}),
		children: (el) => [...el.querySelector(":scope > div:has(> .mt-suggest)").children],
		asProps: ["flex", "min-height", "overflow", "display", "flex-direction"],
	},
	{
		match: (el) => el.matches("div:has(> .mt-suggest) > .text-micro"),
		part: "SuggestHeading",
		props: (el) => ({ text: el.textContent.trim() }),
		leaf: true,
		asProps: ["color", "padding"],
	},
	{
		match: (el) => el.matches(".mt-suggest"),
		part: "SuggestRow",
		props: (el) => ({
			label: el.textContent.trim(),
			recent: el.querySelector("svg.mt-spark") ? undefined : true,
		}),
		leaf: true,
	},
	{
		match: (el) => el.matches("form:has(> .mt-chat-input), .mt-chat-input:not(form > *)"),
		part: "ChatBox",
		// It draws its own words (the dot before the effort) and its own room in the panel's foot.
		ownWords: true,
		asProps: ["flex-shrink", "padding"],
		props: (el) => {
			const box = el.matches(".mt-chat-input") ? el : el.querySelector(".mt-chat-input");
			const picker = box.querySelector("button[aria-haspopup], button.mt-mono");
			const words = [...(picker?.childNodes ?? [])]
				.filter((node) => node.nodeType === Node.TEXT_NODE || node.classList?.contains("sc-interp"))
				.map((node) => node.textContent)
				.join("")
				.trim();
			return {
				label: box.querySelector("label")?.textContent.trim(),
				placeholder: box.querySelector("textarea")?.placeholder || undefined,
				sendLabel: box.querySelector(".mt-send[type=submit], .mt-send")?.getAttribute("aria-label"),
				modelLabel: picker?.getAttribute("aria-label"),
				model: words || undefined,
				effort:
					picker
						?.querySelector(":scope > span:not(.mt-caret):not(.sc-interp)")
						?.textContent.replace(/^·\s*/, "")
						.trim() || undefined,
			};
		},
		leaf: true,
	},
	// A panel beside the page.
	{
		match: (el) => el.matches("aside.mt-panel"),
		part: "Panel",
		props: (el) => ({
			title: el.querySelector(".mt-panel-head > h2")?.textContent.trim(),
			closable: [...el.querySelectorAll(".mt-panel-head > .mt-icon-btn")].some(closes) || undefined,
		}),
		slots: (el) => ({
			actions: [...el.querySelectorAll(".mt-panel-head > .mt-icon-btn")].filter((button) => !closes(button)),
			footer: el.querySelector(":scope > .mt-panel-foot"),
		}),
		// A panel without a body element holds its parts directly (its tabs and their page).
		children: (el) =>
			el.querySelector(":scope > .mt-panel-body") ??
			[...el.children].filter((child) => !child.matches(".mt-panel-head, .mt-panel-foot")),
		asProps: ["flex", "flex-grow", "min-width", "max-width", "min-height", "box-sizing", "display", "flex-direction"],
	},
	{
		match: (el) => el.matches(".mt-icon-btn") && el.textContent.trim() === "⋯",
		part: "MoreButton",
		leaf: true,
		asProps: ["font-size"],
	},
	{
		match: (el) => el.matches(".mt-icon-btn:has(> svg)") && iconName(el.querySelector("svg")) !== undefined,
		part: "IconOnlyButton",
		props: (el) => ({ icon: iconName(el.querySelector("svg")) }),
		leaf: true,
	},
	// A row's drag handle, in its own cell.
	{
		match: (el) => el.matches(".mt-row > span:has(> svg):not(:has(*:not(svg, svg *)))"),
		part: "TableCell",
		asProps: ["color", "cursor", "display"],
	},
	{ match: (el) => el.matches(".mt-row > span > svg"), part: "DragHandle", leaf: true, asProps: ["display"] },
	// A list beside the content (the collections of the settings).
	{
		match: (el) => el.matches("div:has(> nav:not(.mt-sidebar) > .mt-nav)"),
		part: "Rail",
		slots: (el) => ({ rail: el.querySelector(":scope > nav") }),
		children: (el) => [...el.children].filter((child) => !child.matches("nav")),
		asProps: ["display", "flex-wrap", "gap"],
	},
	{
		match: (el) => el.matches("nav:not(.mt-sidebar) > .mt-nav"),
		part: "NavEntry",
		props: (el) => {
			const shown = (node) => node && getComputedStyle(node).display !== "none";
			return {
				label:
					(ownText(el) ? undefined : el.querySelector(":scope > span:first-child")?.textContent.trim()) ||
					[...el.childNodes]
						.filter((node) => node.nodeType === Node.TEXT_NODE || node.classList?.contains("sc-interp"))
						.map((node) => node.textContent)
						.join("")
						.trim(),
				note: el.querySelector(".n")?.textContent.trim(),
				active: el.classList.contains("is-on") || undefined,
				dot: shown(el.querySelector(".mt-change-dot")) ? "changed" : undefined,
			};
		},
		leaf: true,
		asProps: ["color"],
	},
	// What cannot be undone, at the end of a collection's page.
	{
		match: (el) => el.matches(".col-blk:has(> h2[style*='--fg-danger'])"),
		part: "DangerSection",
		props: (el) => ({ title: el.querySelector(":scope > h2")?.textContent.trim() }),
		slots: () => ({}),
		children: (el) => [...el.children].filter((child) => !child.matches("h2")),
		asProps: ["border-bottom", "border-top", "margin-top", "padding-top"],
	},
	{
		match: (el) => el.matches(".col-blk:has(> h2[style*='--fg-danger']) > div"),
		part: "DangerLine",
		props: (el) => ({
			name: el.querySelector(":scope > span > span:first-child")?.textContent.trim(),
			meta: el.querySelector(".text-meta")?.textContent.replace(/^·\s*/, "").trim(),
		}),
		slots: (el) => ({ action: [el.querySelector(":scope > .mt-btn")] }),
		children: () => [],
		asProps: ["display", "align-items", "gap"],
	},
	// The quiet button under a list beside the content.
	{
		match: (el) => el.matches("nav:not(.mt-sidebar) > .mt-text-btn--quiet"),
		part: "RailAdd",
		props: (el) => ({ label: el.textContent.trim() }),
		leaf: true,
		asProps: ["padding", "text-align"],
	},
	// A value under its label with no field.
	{
		match: (el) =>
			el.matches(".mt-field:has(> .mt-label + :is(p:not([style*='display: flex']), span:not([class])):last-child)"),
		part: "ReadValue",
		props: (el) => ({
			label: el.querySelector(":scope > .mt-label")?.textContent.trim(),
			mono: el.querySelector(":scope > p")?.classList.contains("mt-mono") || undefined,
		}),
		slots: () => ({}),
		// A plain value is the part's text; one in its own colour (a warning) is a text of its own.
		children: (el) => el.querySelector(":scope > p") ?? [el.querySelector(":scope > span:last-child")],
		asProps: ["margin", "gap"],
	},
	// A list of fields in tabbed pages: the tab row and the box under it are neighbours in a board, one part in the design system.
	{
		match: (el) => el.matches("nav.mt-ftabs") && el.nextElementSibling?.matches(".mt-ftabs-body"),
		part: "Folder",
		group: (el) => [el, el.nextElementSibling],
	},
	{
		match: (el) => el.matches("nav.mt-ftabs"),
		part: "FolderTabRow",
		props: (el) => ({ add: el.querySelector(":scope > .add")?.getAttribute("aria-label") }),
		slots: () => ({}),
		children: (el) => [...el.querySelectorAll(":scope > .tab")],
		asProps: ["margin-top"],
	},
	{
		match: (el) => el.matches(".mt-ftabs > .tab"),
		part: "FolderTabItem",
		props: (el) => ({
			label: [...el.childNodes]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent)
				.join("")
				.trim(),
			count: el.querySelector(".n")?.textContent.trim(),
			locked: el.querySelector(":scope > svg[role=img]") ? true : undefined,
			fixed: el.closest(".is-readonly") || !el.querySelector(".handle") ? true : undefined,
		}),
		leaf: true,
	},
	{ match: (el) => el.matches(".mt-ftabs-body"), part: "FolderBody", asProps: ["margin-top"] },
	{ match: (el) => el.matches("ul.mt-tree"), part: "FieldTree" },
	{
		match: (el) => el.matches(".mt-tree > li"),
		part: "FieldLine",
		props: (el) => {
			const text = (selector) => el.querySelector(selector)?.textContent.trim() || undefined;
			const own = (node) =>
				[...(node?.childNodes ?? [])]
					.filter((child) => child.nodeType === Node.TEXT_NODE || child.classList?.contains("sc-interp"))
					.map((child) => child.textContent)
					.join("")
					.trim() || undefined;
			const ink = /--fg-([a-z]+)/.exec(el.querySelector(".name")?.getAttribute("style") ?? "")?.[1];
			const lock = el.querySelector(".kind > svg");
			return {
				name: own(el.querySelector(".name")),
				label: own(el.querySelector(".label")),
				description: text(".label > span[style*='--fg-faint']:not(.text-micro)"),
				note: text(".label > .text-micro"),
				kind: own(el.querySelector(".kind")),
				depth: el.classList.contains("d2") ? 1 : el.classList.contains("d3") ? 2 : undefined,
				group: el.classList.contains("is-group") || undefined,
				tone: ["warning", "success", "danger", "faint"].includes(ink) ? ink : undefined,
				locked: lock && getComputedStyle(lock).display !== "none" ? lock.getAttribute("aria-label") : undefined,
				fixed: el.closest(".is-readonly") ? true : undefined,
			};
		},
		leaf: true,
	},
	// Options in equal columns.
	{
		match: (el) => el.matches(".opt-grid"),
		part: "GridBox",
		props: (el) => ({ columns: getComputedStyle(el).gridTemplateColumns.split(" ").length }),
	},
	// The lock after a value nobody can change.
	{
		match: (el) => el.matches(".mt-field svg:not(.mt-btn svg, .mt-text-btn svg)") && !iconName(el),
		part: "Lock",
		leaf: true,
		asProps: ["color", "vertical-align"],
	},
	// A collection's block: a stacked section (its title over its fields); the last one has no line under it.
	{
		match: (el) => el.matches(".col-blk, .col-grp"),
		part: "Section",
		props: (el) => ({ stacked: true, last: /^0(px)?$/.test(el.style.borderBottom.split(" ")[0] ?? "") || undefined }),
		slots: (el) => ({ title: el.querySelector(":scope > h2") }),
		children: (el) => [...el.children].filter((child) => !child.matches("h2")),
		asProps: ["border-bottom"],
	},
	{
		match: (el) => el.matches(".mt-option:has(> .mt-switch)"),
		part: "OptionSwitch",
		props: (el) => ({
			label: el.querySelector(":scope > span:not(.mt-switch)")?.textContent.trim(),
			checked: el.querySelector(".mt-switch.is-on") ? true : undefined,
		}),
		leaf: true,
	},
	// A page's tab row: each tab a page of its own, with its count.
	{ match: (el) => el.matches(".mt-toolbar"), part: "PageToolbar" },
	{
		match: (el) => el.matches(".mt-tabs"),
		part: "TabLinks",
		props: (el) => ({ variant: el.closest(".mt-toolbar") ? "toolbar" : undefined }),
		// A tab row takes the room its line leaves.
		asProps: ["flex-grow"],
	},
	{
		match: (el) => el.matches(".mt-tabs > a"),
		part: "Tab",
		props: (el) => {
			const count = el.querySelector(".mt-count");
			return {
				label: [...el.childNodes]
					.filter((node) => node.nodeType === Node.TEXT_NODE)
					.map((node) => node.textContent)
					.join("")
					.trim(),
				current: el.classList.contains("is-on") || undefined,
				count: count?.textContent.trim(),
				countTone: count?.classList.contains("mt-count--warn") ? "warning" : undefined,
				dot: el.querySelector(".mt-change-dot") ? "warning" : undefined,
			};
		},
		leaf: true,
		// A tab with a mark after its name lines them up itself.
		asProps: ["display", "align-items", "gap"],
	},
	// Under a list: the range, the page size, the page buttons.
	{
		match: (el) => el.matches("footer.mt-table-head"),
		part: "ListFooter",
		asProps: ["display", "align-items", "gap", "padding-top"],
	},
	{ match: (el) => el.matches("footer.mt-table-head > span:empty"), ignore: true },
	{ match: (el) => el.matches("footer.mt-table-head > span"), part: "Count" },
	{
		match: (el) => el.matches(".mt-per-page"),
		part: "PageSize",
		props: (el) => ({ shown: el.textContent.trim() }),
		leaf: true,
	},
	{ match: (el) => el.matches(".mt-pager"), part: "Pager" },
	{
		match: (el) => el.matches(".mt-page"),
		part: "PageButton",
		props: (el) => ({
			step: el.classList.contains("mt-page--prev")
				? "previous"
				: el.classList.contains("mt-page--next")
					? "next"
					: undefined,
			current: el.classList.contains("is-on") || undefined,
			off: el.classList.contains("is-off") || undefined,
			page: el.classList.contains("mt-page--wide") ? undefined : el.textContent.trim(),
		}),
		leaf: true,
		// The step buttons draw their own words.
		ownWords: true,
	},
	// The page's search, before it is opened: a secondary pill with the magnifier.
	{
		match: (el) =>
			el.matches(".mt-page-header .mt-btn--secondary") && iconName(el.querySelector("svg") ?? el) === "search",
		part: "SearchToggle",
		props: (el) => ({ label: el.textContent.trim() }),
		leaf: true,
		asProps: ["padding", "width", "justify-content"],
	},
	// An empty list's steps.
	// An empty list's title and its quiet question, over its steps.
	{
		match: (el) =>
			el.matches("p.text-heading") &&
			el.nextElementSibling?.matches("p.text-title") &&
			el.parentElement.querySelector(":scope > .mt-empty") !== null,
		part: "EmptyHead",
		props: (el) => ({ title: el.textContent.trim(), description: el.nextElementSibling.textContent.trim() }),
		leaf: true,
		asProps: ["margin"],
	},
	{
		match: (el) =>
			el.matches("p.text-heading + p.text-title") && el.parentElement.querySelector(":scope > .mt-empty") !== null,
		ignore: true,
	},
	{ match: (el) => el.matches(".mt-empty"), part: "EmptySteps", asProps: ["border-top"] },
	{
		match: (el) => el.matches(".mt-empty > a"),
		part: "EmptyStep",
		props: (el) => ({
			number: el.querySelector(".mt-count")?.textContent.trim(),
			title: el.querySelector(".text-title")?.textContent.trim(),
		}),
		leaf: true,
	},
	// The app frame's ✦ in the corner opens the assistant beside every screen: the frame's, not a screen's.
	{ match: (el) => el.matches(".mt-icon-btn--corner"), ignore: true },
	// The assistant's ✦ is the design system's own mark, not a Carbon icon.
	{ match: (el) => el.matches("svg.mt-spark"), part: "Icon", props: () => ({ name: "spark" }), leaf: true },
	// A switch with what it turns on under it is two lines of a page, not one field.
	{ match: (el) => el.matches(".mt-field:not(:has(> .mt-option))"), part: "FormField", walk: "parts" },
	{
		match: (el) => el.matches(".mt-label"),
		part: "FormFieldLabel",
		props: (el) => ({ for: el.getAttribute("for") }),
	},
	{
		match: (el) => el.matches(".mt-input"),
		part: "Input",
		props: (el) => ({
			// What is typed is the data's.
			value: el.value || undefined,
			placeholder: el.placeholder || undefined,
			mono: el.classList.contains("mt-mono") || undefined,
			type: el.getAttribute("type"),
			invalid: el.classList.contains("is-error") || undefined,
		}),
	},
	{ match: (el) => el.matches(".mt-error"), part: "FormFieldError" },
	{
		match: (el) => el.matches(".mt-rule-label"),
		part: "Separator",
		props: (el) => ({ label: el.textContent.trim() }),
		leaf: true,
	},
	// The assistant's action, in the proposal blue.
	{
		match: (el) => el.matches(".mt-text-btn") && el.style.color.includes("--fg-proposal"),
		part: "TextButton",
		props: () => ({ tone: "proposal" }),
		asProps: ["color", "display", "align-items", "gap"],
	},
	{
		match: (el) => el.matches(".mt-text-btn"),
		part: "TextButton",
		props: (el) => ({
			variant: ["danger", "ink", "underline", "quiet"].find((name) => el.classList.contains(`mt-text-btn--${name}`)),
		}),
		// A text button with an icon lines it up itself.
		asProps: ["display", "align-items", "gap", "text-decoration"],
	},
	{
		match: (el) => el.matches(".mt-btn"),
		part: "Button",
		props: (el) => ({
			type: el.getAttribute("type"),
			variant: ["primary", "secondary", "danger", "outline-danger"].find((name) =>
				el.classList.contains(`mt-btn--${name}`),
			),
			size: el.classList.contains("mt-btn--sm") ? "sm" : undefined,
			disabled: el.classList.contains("is-disabled") || undefined,
		}),
		// A link drawn as a button takes off the link's underline: the button's own look.
		asProps: ["text-decoration", "gap"],
	},
	{
		match: (el) => /^H[1-4]$/.test(el.tagName) && [...el.classList].some((name) => name.startsWith("text-")),
		part: "Heading",
		props: (el) => ({ as: el.tagName.toLowerCase(), variant: role(el) }),
	},
	{
		// A run laid out by flex (a page's trail of folders) is a group of the screen's, in its role's size; one text otherwise.
		match: (el) =>
			[...el.classList].some((name) => name.startsWith("text-")) &&
			!(el.tagName === "NAV" && getComputedStyle(el).display === "flex"),
		part: "Text",
		props: (el) => ({
			as: el.tagName.toLowerCase(),
			variant: role(el),
			tone: /var\(--fg-([a-z]+)\)/.exec(el.style.color)?.[1],
			align: { center: "center", right: "end", left: "start" }[el.style.textAlign],
		}),
		// What the board writes inline that is one of the part's own props.
		asProps: ["color", "text-align", "flex-grow"],
	},
];

/** The classes this adapter reads: any other class on an element is a look of its own. */
const known =
	/^(mt|mt-(field|label|input|error|rule-label|text-btn|btn|btn--[a-z-]+|sidebar|sidebar-head|sidebar-foot|nav|nav-sub|count|change-dot|seg|tooltip|card|menu-item|icon-btn|icon-btn--corner|spark)|text-[a-z]+|dark|is-(error|disabled|on|rail)|site|n|k|sc-host|sc-interp|mt-empty|mt-page-header|meta|end|mt-list-head|mt-col|mt-col-wrap|mt-col-add|mt-table|mt-table-head|mt-row|mt-row-folder|mt-row-title|mt-row-sub|mt-check|mt-status|mt-status--[a-z]+|mt-per-page|mt-caret|mt-pager|mt-page|mt-page--[a-z]+|is-(sort|end|off|hover)|mt-text-btn--[a-z]+|mt-toolbar|mt-tabs|mt-count--[a-z]+|text-meta|mt-section|body|mt-option|mt-mono|mt-select|mt-filter|mt-banner|mt-banner--[a-z]+|dot|mt-affix|fix|mt-vr|mt-textarea|mt-panel|mt-panel-head|mt-panel-body|mt-panel-foot|col-blk|col-grp|mt-switch|opt-grid|mt-label-row|mt-label-row--changed|mt-del|is-ai|mt-ftabs|mt-ftabs-body|mt-tree|tab|add|d1|d2|d3|is-group|handle|name|label|kind|lv|is-readonly|mt-sheet|mt-backdrop|mt-tabs--bar|mt-seg|mt-radio|mt-change|mt-change--[a-z]+|tag|head|key|note|lines|what|then|is-danger|mt-droparea|is-over|mt-tiles|mt-tiles--folders|mt-tile|is-failed|img|is-file|ext|meta|acts|mt-folder|is-drop|mt-seg--sm|mt-seg--inline|mt-review-line|gut|cell|was|now|side|mt-ins|mt-split|mt-caret--solo|text-reading|mt-block|mt-statusbar|cell|grow|warn|danger|ok|mt-compare|props|mt-diff|mt-bubble|who|mt-tool|mt-untranslated|mt-fill|mt-pair|mt-pair--head|mt-pair--title|gutter|src|dst|is-changed|is-new|mt-doc-callout|mt-doc-code|mt-doc-table|num|mt-shared|mt-props|mt-props-title|mt-ai-action|mt-input-line|mt-input-line--multi|is-bare|mt-chips-field|mt-chip|x|mt-statusbar-list|mt-todo-item|mt-todo-done|mt-menu-label|title|sub|act|plain|mark|is-on|mt-suggest|mt-chat-input|mt-send|mt-msg-user|mt-tool-line|mt-entry-list|slug|mt-proposal-entry|field)$/;

/**
 * What a page's frame does, not a screen: the sidebar and the page side by side wrap on a narrow window (the app's frame, `SidebarInset`); the frame
 * clips what is wider than the window; the line between a screen and a panel beside it is the panel's own (`SidePanel` draws its left edge).
 */
const frame = ["flex-wrap", "overflow", "border-right"];

window.boardPack = { parts, known, frame };
