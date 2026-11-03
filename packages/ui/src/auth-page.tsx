import type * as React from "react";
import { Box } from "./box";
import { Stack } from "./stack";

/**
 * A screen that stands alone, before the admin opens (the login): one narrow column in the middle of the page, the site name over an ink rule at its top
 * (20px apart, 32px above the body), and a line at the foot of the page (the version). The page is padded 48px above, 24px below and 16px at the sides.
 */
function AuthPage({
	title,
	footer,
	children,
}: {
	/** The site's name, a page heading. */
	title: React.ReactNode;
	/** The line at the foot of the page. */
	footer?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<Stack gap={32} minHeight="screen" paddingTop={48} paddingBottom={24} paddingX={16} background="page">
			<Stack grow align="center" justify="center">
				<Box width="full" maxWidth="side-panel">
					<Stack gap={32}>
						<Stack gap={20}>
							{title}
							<Box border="bottom-contrast" />
						</Stack>
						{children}
					</Stack>
				</Box>
			</Stack>
			{footer}
		</Stack>
	);
}

export { AuthPage };
