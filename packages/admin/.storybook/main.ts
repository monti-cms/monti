import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { fontDirs, fontFaces } from "../../ui/.storybook/fonts";

const withFonts = (head: string) => `${head}<style>${fontFaces()}</style>`;
const stub = fileURLToPath(new URL("./node-stub.ts", import.meta.url));

// The admin's screens on a whole site in the browser: PGlite and the core's real operations (build.md rule 6). Dev only; nothing here ships.
const config: StorybookConfig = {
	framework: "@storybook/react-vite",
	stories: ["../src/**/*.stories.tsx"],
	staticDirs: [
		{ from: fontDirs.pretendard, to: "/fonts/pretendard" },
		{ from: fontDirs.plex, to: "/fonts/ibm-plex-mono" },
	],
	previewHead: withFonts,
	managerHead: withFonts,
	viteFinal: (vite) => ({
		...vite,
		plugins: [...(vite.plugins ?? []), tailwindcss()],
		resolve: {
			...vite.resolve,
			alias: {
				...(vite.resolve?.alias as object),
				pg: stub,
				"node:fs/promises": stub,
				"node:path": stub,
				"node:os": stub,
			},
		},
		optimizeDeps: { ...vite.optimizeDeps, exclude: [...(vite.optimizeDeps?.exclude ?? []), "@electric-sql/pglite"] },
	}),
};

export default config;
