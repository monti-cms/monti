import type { Preview } from "@storybook/react-vite";
import "../../ui/.storybook/storybook.css";

/** The admin root every screen sits in: the class the design system's tokens hang on, edge to edge. */
const preview: Preview = {
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="monti-admin min-h-screen bg-monti-page text-monti-default">
				<Story />
			</div>
		),
	],
};

export default preview;
