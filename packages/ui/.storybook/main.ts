import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { fontDirs, fontFaces } from "./fonts";

const withFonts = (head: string) => `${head}<style>${fontFaces()}</style>`;

// The design system's catalog: every component in every variant and state, in light and dark (dev only; nothing here ships).
const config: StorybookConfig = {
	framework: "@storybook/react-vite",
	stories: ["../src/**/*.stories.tsx"],
	addons: ["@storybook/addon-themes", "storybook-addon-pseudo-states"],
	// The `./fonts/...` urls in the rules below resolve against the preview's `iframe.html`.
	staticDirs: [
		{ from: fontDirs.pretendard, to: "/fonts/pretendard" },
		{ from: fontDirs.plex, to: "/fonts/ibm-plex-mono" },
	],
	previewHead: withFonts,
	// The manager's chrome uses the same faces as the preview (`manager-theme.generated.ts` names them).
	managerHead: withFonts,
	viteFinal: (vite) => ({
		...vite,
		plugins: [...(vite.plugins ?? []), tailwindcss()],
	}),
};

export default config;
