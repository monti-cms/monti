import { Stack, type StackProps } from "@monti-cms/ui";

/**
 * The content of a settings page: a column of sections under the page's toolbar, full width of the page column (the column sets the width and the side
 * padding), so no page can drift from the others.
 */
export function PageBody(props: Omit<StackProps, "className">) {
	return <Stack gap={24} width="full" {...props} />;
}
