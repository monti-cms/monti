import { Box, Inline } from "../../index";
import { AdminFrame, type FrameFolder } from "./frame";

const POSTS_FOLDERS: readonly FrameFolder[] = [{ name: "시리즈 원고", count: "2" }];

/** The frame alone, its sidebar open. */
export function SidebarScreen() {
	return <AdminFrame open="posts" folders={POSTS_FOLDERS} />;
}

/** The frame alone, its sidebar folded to a rail. */
export function SidebarRailScreen() {
	return <AdminFrame open="posts" rail />;
}

/** The screen mode on dark: the open sidebar, and beside it the rail with its menu open. */
export function SidebarThemeScreen() {
	return (
		<Inline align="stretch" gap={48}>
			<Box width="sidebar" shrink={false}>
				<AdminFrame open="posts" folders={POSTS_FOLDERS} mode="dark" fixed={false} corner={false} />
			</Box>
			<AdminFrame open="posts" rail mode="dark" modeOpen fixed={false} corner={false} />
		</Inline>
	);
}

/** The frame alone, folded to a rail with its screen mode menu open. */
export function SidebarThemeRailScreen() {
	return <AdminFrame open="posts" rail modeOpen />;
}
