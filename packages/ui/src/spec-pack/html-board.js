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
		props: (el) => ({ active: el.classList.contains("is-on") || undefined }),
		asProps: ["color", "font-weight"],
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
		part: "Text",
		props: () => ({ as: "span" }),
		slots: () => ({}),
		children: (el) => el,
		asProps: ["display", "align-items", "gap", "margin", "border-bottom", "font-weight", "padding-bottom"],
	},
	{ match: (el) => el.matches("div.mt-table"), part: "ListSectionRows" },
	{
		match: (el) => el.matches("div.mt-row"),
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
			title: el.querySelector(".mt-row-title > span:not(.mt-count)"),
			titleCount: el.querySelector(".mt-row-title > .mt-count"),
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
		match: (el) => el.matches(".mt-row"),
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
		match: (el) => el.matches(".mt-row > span:has(> .mt-text-btn)"),
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
		match: (el) => el.matches(".mt-row > a"),
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
		match: (el) => el.matches(".mt-row > .mt-text-btn"),
		part: "ActionsCell",
		leaf: true,
		asProps: ["order", "font-size", "justify-self", "opacity"],
	},
	{ match: (el) => el.matches(".mt-row > span"), part: "TableCell", asProps: ["order", "display", "color", "cursor"] },
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
		children: (el) => el.querySelector(":scope > span:last-child"),
		slots: () => ({}),
		asProps: ["grid-template-columns", "align-items"],
	},
	{
		match: (el) => el.matches(".body > .mt-row > span:last-child > .text-note"),
		part: "LanguageSourceMark",
		props: (el) => ({ flag: el.textContent.trim() }),
		leaf: true,
		asProps: ["display", "color", "font-weight"],
	},
	{ match: (el) => el.matches(".body > .mt-row > span:last-child > .mt-vr"), ignore: true },
	{
		match: (el) => el.matches(".mt-option"),
		part: "OptionCheck",
		props: (el) => ({
			label: [...el.childNodes]
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent)
				.join("")
				.trim(),
			note: el.querySelector(".text-meta")?.textContent.trim(),
			checked: el.querySelector(".mt-check.is-on") ? true : undefined,
		}),
		leaf: true,
		asProps: ["color"],
	},
	{ match: (el) => el.matches(".mt-mono"), part: "Text", props: () => ({ mono: true }) },
	{
		match: (el) => el.matches(".mt-select"),
		part: "SelectBox",
		props: (el) => ({ value: el.textContent.trim(), proposal: el.classList.contains("is-ai") || undefined }),
		leaf: true,
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
			proposal: el.querySelector(".is-ai") ? true : undefined,
		}),
		leaf: true,
	},
	{ match: (el) => el.matches(".mt-vr"), part: "VerticalRule", leaf: true },
	{
		match: (el) => el.matches(".mt-textarea"),
		part: "Textarea",
		props: (el) => ({ mono: el.classList.contains("mt-mono") || undefined }),
		leaf: true,
	},
	// A field's line of help under it, in the role and tone its words have.
	{
		match: (el) => el.matches(".mt-field > span:not([class]):not(:has(input, button))"),
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
	// A panel beside the page.
	{
		match: (el) => el.matches("aside.mt-panel"),
		part: "Panel",
		props: (el) => ({
			title: el.querySelector(".mt-panel-head > h2")?.textContent.trim(),
			closable:
				[...el.querySelectorAll(".mt-panel-head > .mt-icon-btn")].some((button) => button.textContent.trim() === "×") ||
				undefined,
		}),
		slots: (el) => ({
			actions: [...el.querySelectorAll(".mt-panel-head > .mt-icon-btn")].filter(
				(button) => button.textContent.trim() !== "×",
			),
			footer: el.querySelector(":scope > .mt-panel-foot"),
		}),
		children: (el) => el.querySelector(":scope > .mt-panel-body"),
		asProps: ["flex", "flex-grow", "min-width", "box-sizing", "display", "flex-direction"],
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
				label: el.querySelector(":scope > span:first-child")?.textContent.trim(),
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
		match: (el) => el.matches(".mt-field:has(> .mt-label + :is(p, span:not([class])):last-child)"),
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
		props: (el) => ({ type: el.getAttribute("type"), invalid: el.classList.contains("is-error") || undefined }),
	},
	{ match: (el) => el.matches(".mt-error"), part: "FormFieldError" },
	{
		match: (el) => el.matches(".mt-rule-label"),
		part: "Separator",
		props: (el) => ({ label: el.textContent.trim() }),
		leaf: true,
	},
	{
		match: (el) => el.matches(".mt-text-btn"),
		part: "TextButton",
		props: (el) => ({
			variant: ["danger", "ink", "underline", "quiet"].find((name) => el.classList.contains(`mt-text-btn--${name}`)),
		}),
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
		asProps: ["text-decoration"],
	},
	{
		match: (el) => /^H[1-4]$/.test(el.tagName) && [...el.classList].some((name) => name.startsWith("text-")),
		part: "Heading",
		props: (el) => ({ as: el.tagName.toLowerCase(), variant: role(el) }),
	},
	{
		match: (el) => [...el.classList].some((name) => name.startsWith("text-")),
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
	/^(mt|mt-(field|label|input|error|rule-label|text-btn|btn|btn--[a-z-]+|sidebar|sidebar-head|sidebar-foot|nav|nav-sub|count|change-dot|seg|tooltip|card|menu-item|icon-btn|icon-btn--corner|spark)|text-[a-z]+|dark|is-(error|disabled|on|rail)|site|n|k|sc-host|sc-interp|mt-empty|mt-page-header|meta|end|mt-list-head|mt-col|mt-col-wrap|mt-col-add|mt-table|mt-table-head|mt-row|mt-row-folder|mt-row-title|mt-row-sub|mt-check|mt-status|mt-status--[a-z]+|mt-per-page|mt-caret|mt-pager|mt-page|mt-page--[a-z]+|is-(sort|end|off|hover)|mt-text-btn--[a-z]+|mt-toolbar|mt-tabs|mt-count--[a-z]+|text-meta|mt-section|body|mt-option|mt-mono|mt-select|mt-filter|mt-banner|mt-banner--[a-z]+|dot|mt-affix|fix|mt-vr|mt-textarea|mt-panel|mt-panel-head|mt-panel-body|mt-panel-foot|col-blk|col-grp|mt-switch|opt-grid|mt-label-row|mt-label-row--changed|mt-del|is-ai)$/;

/** What a page's frame does, not a screen: the sidebar and the page side by side wrap on a narrow window (the app's frame, `SidebarInset`). */
const frame = ["flex-wrap"];

window.boardPack = { parts, known, frame };
