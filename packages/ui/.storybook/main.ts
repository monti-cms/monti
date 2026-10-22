import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

// The design system's catalog: every component in every variant and state, in light and dark. The admin's screen states join it from
// `packages/admin` (dev only; nothing here ships).
const config: StorybookConfig = {
	framework: "@storybook/react-vite",
	stories: ["../src/**/*.stories.tsx", "../../admin/src/**/*.stories.tsx"],
	addons: ["@storybook/addon-themes"],
	viteFinal: (vite) => ({ ...vite, plugins: [...(vite.plugins ?? []), tailwindcss()] }),
};

export default config;
