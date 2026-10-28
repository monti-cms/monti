import type { ReactNode } from "react";
import tokens from "../../tokens/tokens.json";
import { Stack } from "../stack";
import { Text } from "../text";

/**
 * What the Foundations pages read: `tokens/tokens.json` itself, the file `scripts/gen-tokens.mjs` writes `styles/tokens.css` and `styles/theme.css`
 * from, so a page cannot drift from what the components use. Every sample is painted through the token's own CSS variable.
 */
export { tokens };

export const px = (name: string) => `var(--monti-${name})`;

/** The class a token is used through: `bg-tool` → `bg-monti-tool`, `fg-faint` → `text-monti-faint`, `width-sheet` → `w-monti-sheet`, `height-icon-button` → `h-monti-icon-button`. */
const CLASS_PREFIX: Record<string, string> = { fg: "text", width: "w", height: "h" };
export const classOf = (token: string) => {
	const [group, ...rest] = token.split("-");
	return `${CLASS_PREFIX[group] ?? group}-monti-${rest.join("-")}`;
};

export const Page = ({ children }: { children: ReactNode }) => <Stack gap={32}>{children}</Stack>;

export function Group({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Stack gap={12}>
			<Text variant="title">{title}</Text>
			<Stack direction="row" gap={16} wrap>
				{children}
			</Stack>
		</Stack>
	);
}

/** A token's name, its value and its usage line, under whatever sample is drawn above it. */
export function Spec({ name, usage, children }: { name: string; usage?: string; children: ReactNode }) {
	return (
		<Stack gap={4} className="w-56">
			{children}
			<Text variant="meta">{name}</Text>
			{usage && (
				<Text variant="note" tone="muted">
					{usage}
				</Text>
			)}
		</Stack>
	);
}
