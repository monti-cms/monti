import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { TooltipProvider } from "../src/tooltip";
import "./storybook.css";

const preview: Preview = {
	parameters: {
		layout: "fullscreen",
		controls: { expanded: true },
		// The design system's groups, tokens first. Screen stories (admin, plugins) follow.
		options: {
			storySort: {
				order: [
					"Foundations",
					["Colors", "Type", "Spacing", "Radius", "Sizes", "Shadows"],
					"Button",
					"Field",
					"Choice",
					"Tabs",
					"List",
					"Menu",
					"Overlay",
					"Status",
					"Frame",
					"EditorTools",
					"Change",
					"Proposal",
					"Assistant",
					"Translation",
					"Layout",
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
