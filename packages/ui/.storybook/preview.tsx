import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { TooltipProvider } from "../src/tooltip";
import "./storybook.css";

const preview: Preview = {
	parameters: {
		layout: "padded",
		controls: { expanded: true },
		// The tokens first: everything below is built from them.
		options: { storySort: { order: ["Foundations", "Layout", "Controls", "Feedback", "Overlays", "*"] } },
	},
	decorators: [
		(Story) => (
			<TooltipProvider>
				<div className="monti-admin bg-monti-page p-4 text-monti-default">
					<Story />
				</div>
			</TooltipProvider>
		),
		// The admin's dark theme follows `.dark` on `html`; the toolbar switches it.
		withThemeByClassName({ themes: { light: "", dark: "dark" }, defaultTheme: "light", parentSelector: "html" }),
	],
};

export default preview;
