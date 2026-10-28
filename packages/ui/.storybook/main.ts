import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(here, "../../admin");
const buildStyles = pathToFileURL(path.resolve(here, "../../../scripts/build-styles.mjs")).href;
// The admin's fonts come from the same place the admin bundle takes them (`bundledFonts`): the package's own Pretendard and IBM Plex Mono files,
// registered under the bundle's names (`Monti Pretendard`, `Monti Plex Mono`), which the font tokens read.
const adminRequire = createRequire(path.join(adminDir, "package.json"));
const pretendardSubsets = path.join(
	path.dirname(adminRequire.resolve("pretendard/package.json")),
	"dist/web/variable/woff2-dynamic-subset",
);
const plexFiles = path.join(path.dirname(adminRequire.resolve("@fontsource/ibm-plex-mono/package.json")), "files");

/** Adds the admin's `@font-face` rules to a document head. */
const withFonts = async (head: string) => {
	const { bundledFonts } = await import(/* @vite-ignore */ buildStyles);
	return `${head}<style>${bundledFonts(adminDir).css}</style>`;
};

// The design system's catalog: every component in every variant and state, in light and dark. The admin's screen states join it from
// `packages/admin` and the plugins (dev only; nothing here ships).
const config: StorybookConfig = {
	framework: "@storybook/react-vite",
	stories: ["../src/**/*.stories.tsx", "../../{admin,ai,blocks,mdx,seo}/src/**/*.stories.tsx"],
	addons: ["@storybook/addon-themes"],
	// The `./fonts/...` urls in the rules below resolve against the preview's `iframe.html`.
	staticDirs: [
		{ from: pretendardSubsets, to: "/fonts/pretendard" },
		{ from: plexFiles, to: "/fonts/ibm-plex-mono" },
	],
	previewHead: withFonts,
	// The manager's chrome uses the same faces as the preview (`manager-theme.generated.ts` names them).
	managerHead: withFonts,
	// Screen stories build the test site, which picks its variant from the environment: the default one here.
	viteFinal: (vite) => ({
		...vite,
		plugins: [...(vite.plugins ?? []), tailwindcss()],
		define: { ...vite.define, "process.env.MONTI_TEST_SITE": "undefined" },
	}),
};

export default config;
