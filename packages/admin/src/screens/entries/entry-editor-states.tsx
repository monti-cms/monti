"use client";

// The loading and load-error states of the entry editor screen.

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, Inline, Skeleton, Stack, Text } from "@monti-cms/ui";
import { AdminLink as Link } from "../../router";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";

/** As many tool placeholders as the toolbar shows at its usual width. */
const TOOLS = Array.from({ length: 12 }, (_, index) => index);

/** The editor's frame while the entry loads, in the places and sizes the loaded screen uses, so nothing jumps when it arrives. */
export function EntryEditorLoading() {
	const t = useTranslator(entryEditorShellMessages);
	return (
		<Stack gap="none" height="screen" overflow="clip" background="page" aria-busy="true">
			<Text srOnly>{t("loadingDocument")}</Text>

			{/* Header: back, address and status on the left; save, preview, publish, panel and more on the right. */}
			<Inline
				as="header"
				justify="between"
				gap="tight"
				shrink={false}
				border="bottom"
				paddingX="comfortable"
				paddingY="condensed"
			>
				<Inline gap="condensed">
					<Skeleton shape="icon" />
					<Skeleton shape="line" width="medium" />
					<Skeleton shape="line" width="chip" />
				</Inline>
				<Inline gap="condensed">
					<Skeleton shape="control-sm" width="short" />
					<Skeleton shape="control-sm" width="chip" />
					<Skeleton shape="icon" />
					<Skeleton shape="icon" />
				</Inline>
			</Inline>

			<Inline align="stretch" gap="none" grow minHeight={0} overflow="hidden">
				<Stack gap="none" grow minWidth={0}>
					{/* Formatting toolbar, its tools centered. */}
					<Inline gap="tight" justify="center" shrink={false} border="bottom" paddingX="spacious" paddingY="condensed">
						<Skeleton shape="control-sm" width="short" />
						{TOOLS.map((tool) => (
							<Skeleton key={tool} shape="icon" />
						))}
					</Inline>

					<Stack gap="none" grow minHeight={0} overflow="hidden">
						{/* Language tabs and the title, in the writing column, above a hairline. */}
						<Stack
							gap="spacious"
							width="full"
							maxWidth="detail"
							centered
							border="bottom"
							paddingX="comfortable"
							paddingTop="section"
							paddingBottom="comfortable"
						>
							<Inline gap="condensed">
								<Skeleton shape="line" width="short" />
								<Skeleton shape="line" width="short" />
							</Inline>
							<Skeleton shape="heading" width="half" />
						</Stack>
						{/* The body, in the same column, indented past the block handles as the text is. */}
						<Stack gap="spacious" width="full" maxWidth="detail" centered paddingX="wide" paddingTop="spacious">
							<Stack gap="normal">
								<Skeleton shape="line" />
								<Skeleton shape="line" />
								<Skeleton shape="line" width="three-quarters" />
							</Stack>
							<Skeleton shape="title" width="third" />
							<Stack gap="normal">
								<Skeleton shape="line" />
								<Skeleton shape="line" width="half" />
							</Stack>
						</Stack>
					</Stack>
				</Stack>

				{/* The properties panel at its default width (it opens with the editor on wide screens). */}
				<Stack as="aside" gap="none" hideBelow="lg" width="panel-lg" shrink={false} border="left">
					<Inline justify="between" shrink={false} border="bottom" paddingX="comfortable" paddingY="condensed">
						<Inline gap="normal">
							<Skeleton shape="line" width="chip" />
							<Skeleton shape="line" width="chip" />
						</Inline>
						<Skeleton shape="icon" />
					</Inline>
					<Stack gap="comfortable" padding="comfortable">
						<Stack gap="condensed">
							<Skeleton shape="line" width="short" />
							<Skeleton shape="control" />
						</Stack>
						<Stack gap="condensed">
							<Skeleton shape="line" width="short" />
							<Skeleton shape="block" />
						</Stack>
						<Stack gap="condensed">
							<Skeleton shape="line" width="short" />
							<Skeleton shape="control" />
						</Stack>
						<Stack gap="condensed">
							<Skeleton shape="line" width="short" />
							<Skeleton shape="control" />
						</Stack>
					</Stack>
				</Stack>
			</Inline>
		</Stack>
	);
}

export function EntryEditorLoadError({ message }: { message: string }) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	return (
		<Stack gap="normal" padding="wide">
			{/* The shared notice: a grid Alert without an icon put the text in the 16px icon column, one letter per line. */}
			<LoadErrorAlert message={message} />
			<Box>
				<Button variant="outline" nativeButton={false} render={<Link role="link" href={site.adminHref()} />}>
					{t("backToList")}
				</Button>
			</Box>
		</Stack>
	);
}
