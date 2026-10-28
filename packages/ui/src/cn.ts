import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design system's own names (styles/theme.css) that tailwind-merge cannot guess; `cn.test.ts` checks the lists against the generated theme.
// The type roles (`text-monti-<role>`) are font sizes: read as text colors, a component's own `text-monti-body` would survive next to a caller's
// `text-monti-display` and win by CSS order. The same goes for the shadows (`shadow-monti-floating`, else read as a shadow color), the letter spacing
// (`tracking-caps`), the radii, the heights and the widths.
const SPACING = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48].map((step) => `monti-${step}`);
const CONTROLS = ["monti-control-md", "monti-control-sm", "monti-icon-button"];
const ICONS = ["monti-icon-xs", "monti-icon-sm", "monti-icon-md", "monti-icon-lg"];
const BARS = ["monti-header", "monti-toolbar", "monti-panebar", "monti-statusbar"];
const COLUMNS = [
	"monti-sidebar",
	"monti-rail",
	"monti-menu",
	"monti-panel",
	"monti-side-panel",
	"monti-assistant",
	"monti-sheet",
	"monti-content",
	"monti-reading",
];

const twMerge = extendTailwindMerge({
	extend: {
		// The spacing scale next to Tailwind's numbers: without it `p-monti-4` and `p-monti-16` would both survive a merge.
		theme: {
			spacing: SPACING,
			container: COLUMNS,
			radius: ["monti-sm", "monti-md", "monti-lg", "monti-xl", "monti-full"],
			shadow: ["monti-floating", "monti-overlay", "monti-sheet"],
		},
		classGroups: {
			"font-size": [
				{
					text: [
						"monti-display",
						"monti-page",
						"monti-heading",
						"monti-reading",
						"monti-title",
						"monti-body",
						"monti-label",
						"monti-note",
						"monti-caption",
						"monti-meta",
						"monti-micro",
					],
				},
			],
			tracking: [{ tracking: ["caps"] }],
			h: [{ h: [...CONTROLS, ...BARS] }],
			"min-h": [{ "min-h": [...CONTROLS, ...BARS] }],
			size: [{ size: [...CONTROLS, ...ICONS] }],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
