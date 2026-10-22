import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { TooltipProvider } from "../src/tooltip";
import "./storybook.css";

const preview: Preview = {
	parameters: { layout: "padded", controls: { expanded: true } },
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
