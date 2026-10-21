import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale roles (`text-monti-<role>`, styles/theme.css) are font sizes. Without this, tailwind-merge reads them as text colors,
// so a component's own `text-sm` would survive next to a caller's `text-monti-display` and win by CSS order.
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
						"monti-title",
						"monti-heading",
						"monti-display",
					],
				},
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
