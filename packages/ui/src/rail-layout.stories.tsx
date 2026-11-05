import type { Meta, StoryObj } from "@storybook/react-vite";
import { Add } from "./icons";
import { Button, NavLink, RailLayout, Section, Text } from "./index";

/** A page part with a list of links beside it, as the collections sit beside their editor in Settings. Narrow, the content wraps under the links. */
const meta = {
	title: "Patterns/Frame/RailLayout",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collections: Story = {
	render: () => (
		<RailLayout
			label="컬렉션"
			rail={
				<>
					<NavLink active note="posts" onSelect={() => {}}>
						게시글
					</NavLink>
					<NavLink note="notes" onSelect={() => {}}>
						노트
					</NavLink>
					<Button variant="ghost" size="sm">
						<Add />새 컬렉션
					</Button>
				</>
			}
		>
			<Section title="기본">
				<Text variant="note">게시글 컬렉션의 설정</Text>
			</Section>
		</RailLayout>
	),
};
