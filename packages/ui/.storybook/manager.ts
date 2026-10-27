import { addons } from "storybook/manager-api";
import { create } from "storybook/theming/create";
import { MANAGER_THEME } from "./manager-theme.generated";

// Storybook's own chrome (sidebar, toolbar, panels) wears the admin's roles, from `tokens.json` through `pnpm gen:tokens`. It follows the
// operating system's light or dark; the preview canvas has its own switch in the toolbar.
const query = window.matchMedia("(prefers-color-scheme: dark)");
const mode = query.matches ? "dark" : "light";

addons.setConfig({
	theme: create({ base: mode, ...MANAGER_THEME[mode], brandTitle: "Monti Admin" }),
});
// The theme is read once at load: a change of the system's setting reloads the manager into the other one.
query.addEventListener("change", () => window.location.reload());
