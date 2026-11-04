import type { StorybookConfig } from "@storybook/react-vite";
import ui from "../../ui/.storybook/main";

// The admin's screens, drawn from their presentational views with the board's data. Everything but the stories comes from the design system's
// Storybook (fonts, Tailwind, the theme addon), so a screen story looks exactly like the parts' stories. `@monti-cms/ui` never imports the admin.
const config: StorybookConfig = { ...ui, stories: ["../src/**/*.stories.tsx"] };

export default config;
