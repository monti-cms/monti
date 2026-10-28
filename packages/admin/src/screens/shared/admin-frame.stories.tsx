import { PageBody, PageColumn, PageHeader, SidePanel, Spark, Text } from "@monti-cms/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { testSite } from "../../../../core/test/site";
import { preferenceKey } from "../../lib/utils/site-storage";
import { PageFrame } from "../../stories/screen-frame";
import { AdminFrame } from "./admin-frame";
import { AdminPanelProvider } from "./side-panel-slot";

const meta = { title: "Screens/Frame", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The page of a story: a title row and a line of text, in the column the frame centres. */
const Page = () => (
	<PageColumn>
		<PageHeader title="게시글" meta="/posts/:slug" />
		<PageBody>
			<Text tone="muted">본문</Text>
		</PageBody>
	</PageColumn>
);

/** The assistant's panel, the plugin panel: docked at the window's right edge, full height, beside the whole page; the page centres in the room left. */
export const PluginPanelOpen: Story = {
	tags: ["visual"],
	render: () => {
		window.localStorage.setItem(preferenceKey(testSite, "side-panel"), "1");
		return (
			<PageFrame api={() => ({ items: [], total: 0, counts: { failed: 0, dead: 0 } })} pathname="/admin">
				<AdminPanelProvider
					panel={{
						label: "어시스턴트",
						icon: Spark,
						Component: ({ onClose }) => (
							<SidePanel title="어시스턴트" width="assistant" onClose={onClose}>
								<Text tone="muted">무엇을 도와 드릴까요?</Text>
							</SidePanel>
						),
					}}
				>
					<AdminFrame sidebar={{ activeNav: testSite.DEFAULT_COLLECTION }}>
						<Page />
					</AdminFrame>
				</AdminPanelProvider>
			</PageFrame>
		);
	},
};
