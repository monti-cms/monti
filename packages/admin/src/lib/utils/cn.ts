import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design system's own names (styles/theme.css) that tailwind-merge cannot guess. The type roles (`text-monti-<role>`) are font sizes: read as
// text colors, a component's own `text-monti-body` would survive next to a caller's `text-monti-display` and win by CSS order. The same goes for the
// one shadow (`shadow-monti-floating`, else read as a shadow color) and the one letter spacing (`tracking-caps`).
const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			"font-size": [
				{
					text: [
						"monti-micro",
						"monti-caption",
						"monti-label",
						"monti-body",
						"monti-reading",
						"monti-title",
						"monti-heading",
						"monti-display",
					],
				},
			],
			shadow: [{ shadow: ["monti-floating"] }],
			tracking: [{ tracking: ["caps"] }],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
