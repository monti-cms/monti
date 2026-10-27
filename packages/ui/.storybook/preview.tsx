import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import { cn } from "../src/cn";
import { DEFAULT_UI_LABELS, UiLabelsProvider } from "../src/labels";
import { TooltipProvider } from "../src/tooltip";
import { KO_UI_LABELS } from "./ko-labels";
import "./storybook.css";

type Language = "ko" | "en";

/**
 * The page every story sits on: the admin root, the language of the words the components write, and the tooltip provider. The root keeps 16px
 * around a story, except for a story that draws a pane edge to edge (`parameters: { bleed: true }`): there the story touches the frame.
 */
function Frame({ language, bleed, children }: { language: Language; bleed: boolean; children: ReactNode }) {
	useEffect(() => {
		document.documentElement.lang = language;
	}, [language]);
	return (
		<UiLabelsProvider labels={language === "ko" ? KO_UI_LABELS : DEFAULT_UI_LABELS}>
			<TooltipProvider>
				<div className={cn("monti-admin min-h-screen bg-monti-page text-monti-default", !bleed && "p-monti-16")}>
					{children}
				</div>
			</TooltipProvider>
		</UiLabelsProvider>
	);
}

const preview: Preview = {
	// The admin is Korean first: stories show the Korean words the components write themselves, and `<html lang="ko">` (word breaks, hyphenation, the
	// screen reader's voice). The toolbar switches to English, the components' defaults.
	globalTypes: {
		language: {
			description: "Language of the words the components write themselves",
			toolbar: {
				title: "Language",
				icon: "globe",
				items: [
					{ value: "ko", title: "한국어" },
					{ value: "en", title: "English" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: { language: "ko" satisfies Language },
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
		(Story, { globals, parameters }) => (
			<Frame language={globals.language === "en" ? "en" : "ko"} bleed={parameters.bleed === true}>
				<Story />
			</Frame>
		),

		// The tokens' own dark selector: `.dark` on `html` (`html:is(.dark, [data-theme="dark"]):has(.monti-admin)`); the toolbar switches it.
		withThemeByClassName({ themes: { light: "", dark: "dark" }, defaultTheme: "light", parentSelector: "html" }),
	],
};

export default preview;
