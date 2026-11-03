// Monti's HTML board classes, for the screen spec tool's HTML adapter (`scripts/convert-board/html-adapter.js`): the design system's CSS classes on a canvas
// board (`.mt-btn--primary`) and the part each one draws. Loaded into the board's page before the adapter.

/** The text role of an element (`text-page` is `page`). */
const role = (el) => [...el.classList].find((name) => name.startsWith("text-"))?.slice(5);

/** The design system's classes and the part each one draws, first match wins. `props` reads the element's own values. */
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
		match: (el) => el.matches(".mt-nav"),
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
	{ match: (el) => el.matches(".mt-count"), part: "Count" },
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
	// The assistant's ✦ is the design system's own mark, not a Carbon icon.
	{ match: (el) => el.matches("svg.mt-spark"), part: "Icon", props: () => ({ name: "spark" }), leaf: true },
	{ match: (el) => el.matches(".mt-field"), part: "FormField", walk: "parts" },
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
	{ match: (el) => el.matches(".mt-text-btn"), part: "TextButton", props: (el) => ({ type: el.getAttribute("type") }) },
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
		asProps: ["color", "text-align"],
	},
];

/** The classes this adapter reads: any other class on an element is a look of its own. */
const known =
	/^(mt|mt-(field|label|input|error|rule-label|text-btn|btn|btn--[a-z-]+|sidebar|sidebar-head|sidebar-foot|nav|nav-sub|count|change-dot|seg|tooltip|card|menu-item|icon-btn|icon-btn--corner|spark)|text-[a-z]+|dark|is-(error|disabled|on|rail)|site|n|k|sc-host)$/;

window.boardPack = { parts, known };
