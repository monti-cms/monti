import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import type { TestProjectInlineConfiguration } from "vitest/config";
import { fontDirs, fontFaces } from "../packages/ui/.storybook/fonts";
import {
	dragPointer,
	dropPointer,
	holdKey,
	keyTwice,
	movePointer,
	pressTwice,
	releaseKey,
	slowCpu,
	typeKorean,
} from "./commands";

const FONTS = "virtual:monti-fonts";

/** The admin's `@font-face` rules (as Storybook adds them), served straight from the font packages: text is measured in the fonts a person sees. */
export function fonts(): Plugin {
	return {
		name: "monti-fonts",
		resolveId: (id) => (id === FONTS ? `\0${FONTS}` : null),
		load(id) {
			if (id !== `\0${FONTS}`) return null;
			const css = fontFaces()
				.replaceAll("url(./fonts/pretendard/", `url(/@fs${fontDirs.pretendard}/`)
				.replaceAll("url(./fonts/ibm-plex-mono/", `url(/@fs${fontDirs.plex}/`);
			return `export default ${JSON.stringify(css)};`;
		},
	};
}

/**
 * A Vitest project in a real browser (docs/testing.md, L3 and L4): Chromium through Playwright at 1440 × 900 in UTC, Tailwind and the admin's fonts,
 * and the commands of `testing/commands.ts`. Each package's setup file puts the styles and fonts on the page (`testing/setup.ts`).
 */
export function browserProject({
	name,
	include,
	setupFiles,
	plugins = [],
	...vite
}: {
	name: string;
	include: string[];
	setupFiles: string[];
} & Omit<TestProjectInlineConfiguration, "test">): TestProjectInlineConfiguration {
	return {
		...vite,
		plugins: [...plugins, tailwindcss(), fonts()],
		test: {
			name,
			include,
			setupFiles,
			testTimeout: 30_000,
			browser: {
				enabled: true,
				headless: true,
				provider: playwright({ contextOptions: { timezoneId: "UTC", locale: "ko-KR" } }),
				instances: [{ browser: "chromium" }],
				viewport: { width: 1440, height: 900 },
				commands: {
					dragPointer,
					dropPointer,
					holdKey,
					keyTwice,
					movePointer,
					pressTwice,
					releaseKey,
					slowCpu,
					typeKorean,
				},
			},
		},
	};
}
