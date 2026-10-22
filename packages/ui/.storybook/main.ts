import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

// The design system's catalog: every component in every variant and state, in light and dark. The admin's screen states join it from
// `packages/admin` and the plugins (dev only; nothing here ships).
const config: StorybookConfig = {
	framework: "@storybook/react-vite",
	stories: ["../src/**/*.stories.tsx", "../../{admin,ai,blocks,mdx,seo,git-sync}/src/**/*.stories.tsx"],
	addons: ["@storybook/addon-themes"],
	// Screen stories build the test site, which picks its variant from the environment: the default one here.
	viteFinal: (vite) => ({
		...vite,
		plugins: [...(vite.plugins ?? []), tailwindcss()],
		define: { ...vite.define, "process.env.MONTI_TEST_SITE": "undefined" },
	}),
};

export default config;
