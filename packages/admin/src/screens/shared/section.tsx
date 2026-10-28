import { Box, Grid, Heading, Stack, Text } from "@monti-cms/ui";
import { createContext, type ReactNode, useContext } from "react";

const SectionRowContext = createContext(false);

/** True when a field or switch sits directly inside a `Section` band of key-value rows. */
export function useInSectionRow(): boolean {
	return useContext(SectionRowContext);
}

/**
 * One section of a settings screen: the title and a one-line description in a column on the left, the content in a card or divided key-value rows on the right
 * (stacked on a narrow screen). A section is page > section > rows: the card holds fields or one list, never another bordered box.
 */
export function Section({
	title,
	description,
	note,
	children,
	wide = false,
	card = true,
	band,
	rows,
	danger,
	testId,
	id,
}: {
	title: ReactNode;
	description?: ReactNode;
	/** A second line under the description, in the same style (what cannot be changed, a warning about the file). */
	note?: ReactNode;
	children: ReactNode;
	/** A wider label column (260px instead of 220px) for longer titles. */
	wide?: boolean;
	/** `false` when the content is a card of its own (a list of rows with its own header). */
	card?: boolean;
	/** A band instead of a card: the content sits on the page, and a hairline above the section separates it from the one before. */
	band?: boolean;
	/** Whether the band's children are horizontal key-value setting rows separated by hairlines (`true` by default for `band` sections). */
	rows?: boolean;
	/** A step that cannot be undone: the title in the danger color and the content in a box with a danger border. */
	danger?: boolean;
	testId?: string;
	/** Anchor of the section, so a link can land on it (`#id`). */
	id?: string;
}) {
	const titleId = testId ? `${testId}-title` : undefined;
	const isRowBand = rows ?? Boolean(band && card && !danger);
	return (
		<Grid
			as="section"
			id={id}
			data-testid={testId}
			aria-labelledby={titleId}
			columns={wide ? "rail-wide" : "rail"}
			gap={32}
			align="start"
			band={band}
		>
			<Stack gap={8}>
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
				<Stack gap={16} minWidth={0} border="danger" radius="lg" padding={16}>
					{children}
				</Stack>
			) : isRowBand ? (
				<SectionRowContext.Provider value={true}>
					<Stack gap={0} divided minWidth={0}>
						{children}
					</Stack>
				</SectionRowContext.Provider>
			) : band ? (
				<Stack gap={24} minWidth={0}>
					{children}
				</Stack>
			) : card ? (
				<Box padding={16}>
					<Stack gap={24} minWidth={0}>
						{children}
					</Stack>
				</Box>
			) : (
				<Box minWidth={0}>{children}</Box>
			)}
		</Grid>
	);
}
