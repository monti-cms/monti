import type { ReactNode } from "react";
import { Text } from "./text";

/** What a story writes over a sample (the option and its value, the state): the design system's label look, mono 11 in the subtle ink, so a caption never reads as part of the sample. */
export function StoryCaption({ children }: { children: ReactNode }) {
	return (
		<Text as="div" variant="micro" tone="subtle">
			{children}
		</Text>
	);
}
