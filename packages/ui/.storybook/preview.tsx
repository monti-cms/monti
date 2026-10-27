import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { TooltipProvider } from "../src/tooltip";
import "./storybook.css";

const preview: Preview = {
	parameters: {
		layout: "fullscreen",
		controls: { expanded: true },
		// The design system's five tiers, smallest part first, then the screen stories (admin, plugins). Foundations and Primitives hold pages
		// (`Tier/Name`); Controls, Patterns and Monti hold groups (`Tier/Group/Name`). `storySort` must be written inline, so the parity test reads it here.
		options: {
			storySort: {
				order: [
					"Foundations",
					["Colors", "Type", "Spacing", "Radius", "Sizes", "Shadows"],
					"Primitives",
					["Box", "Stack", "Grid", "Text", "Icon", "AI mark", "Label", "Separator", "*"],
					"Controls",
					["Button", "Field", "Choice", "Tabs", "Menu", "Overlay", "Status"],
					"Patterns",
					["List", "Frame", "Sheet"],
					"Monti",
					["EditorTools", "Change", "Proposal", "Assistant", "Translation"],
					"Screens",
					"*",
				],
			},
		},
	},
	decorators: [
		(Story) => (
			<TooltipProvider>
				<div className="monti-admin min-h-screen bg-monti-page p-monti-16 text-monti-default">
					<Story />
				</div>
			</TooltipProvider>
		),
		// The tokens' own dark selector: `.dark` on `html` (`html:is(.dark, [data-theme="dark"]):has(.monti-admin)`); the toolbar switches it.
		withThemeByClassName({ themes: { light: "", dark: "dark" }, defaultTheme: "light", parentSelector: "html" }),
	],
};

export default preview;
