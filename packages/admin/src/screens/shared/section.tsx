import { Box, Grid, Heading, Panel, Stack, Text } from "@monti-cms/ui";
import type { ReactNode } from "react";

/**
 * One section of a settings screen: the title and a one-line description in a column on the left, the content in a card on the right (stacked on a narrow
 * screen). A section is page > section > rows: the card holds fields or one list, never another bordered box.
 */
export function Section({
	title,
	description,
	note,
	children,
	card = true,
	band,
	danger,
	testId,
	id,
}: {
	title: ReactNode;
	description?: ReactNode;
	/** A second line under the description, in the same style (what cannot be changed, a warning about the file). */
	note?: ReactNode;
	children: ReactNode;
	/** Kept for callers: the left column is one width now (the panel width), wide or not. */
	wide?: boolean;
	/** `false` when the content is a card of its own (a list of rows with its own header). */
	card?: boolean;
	/** A band instead of a card: the content sits on the page, and a hairline above the section separates it from the one before. */
	band?: boolean;
	/** A step that cannot be undone: the title in the danger color and the content in a box with a danger border. */
	danger?: boolean;
	testId?: string;
	/** Anchor of the section, so a link can land on it (`#id`). */
	id?: string;
}) {
	const titleId = testId ? `${testId}-title` : undefined;
	return (
		// design-system: needs Grid columns rail / rail-wide (the 220 / 260px label column, tokens w-rail / w-rail-wide) and a band separator that skips the first section
		<Grid
			as="section"
			id={id}
			data-testid={testId}
			aria-labelledby={titleId}
			columns="sidebar"
			gap="comfortable"
			align="start"
			border={band ? "top" : undefined}
			paddingTop={band ? "wide" : undefined}
		>
			<Stack gap="condensed">
				<Heading as="h3" id={titleId} tone={danger ? "danger" : undefined}>
					{title}
				</Heading>
				{description && (
					<Text as="p" variant="label" tone="muted">
						{description}
					</Text>
				)}
				{note && (
					<Text as="p" variant="label" tone="muted">
						{note}
					</Text>
				)}
			</Stack>
			{danger ? (
				<Stack gap="comfortable" minWidth={0} border="danger" radius="lg" padding="comfortable">
					{children}
				</Stack>
			) : band ? (
				<Stack gap="spacious" minWidth={0}>
					{children}
				</Stack>
			) : card ? (
				<Panel padding="comfortable">
					<Stack gap="spacious" minWidth={0}>
						{children}
					</Stack>
				</Panel>
			) : (
				<Box minWidth={0}>{children}</Box>
			)}
		</Grid>
	);
}
