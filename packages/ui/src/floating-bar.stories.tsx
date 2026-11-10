import type { Meta, StoryObj } from "@storybook/react-vite";
import { Edit, Settings, SettingsAdjust, TextAlignCenter, TextAlignLeft, TextAlignRight, TrashCan } from "./icons";
import { FloatingBar, FloatingBarButton, Separator } from "./index";

/** The small floating row of tools: 3px inside, 2px between 28px buttons, a rule between groups, the floating shadow. */
const meta = { title: "Monti/EditorTools/FloatingBar", component: FloatingBar } satisfies Meta<typeof FloatingBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Icon buttons in two groups. A tool that is on (`pressed`) keeps its background; its name is in the tooltip. */
export const Default: Story = {
	render: () => (
		<FloatingBar aria-label="이미지 도구">
			<FloatingBarButton label="왼쪽 정렬">
				<TextAlignLeft aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="가운데 정렬" pressed>
				<TextAlignCenter aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="오른쪽 정렬">
				<TextAlignRight aria-hidden />
			</FloatingBarButton>
			<Separator orientation="vertical" length="bar" />
			<FloatingBarButton label="편집">
				<Edit aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="설정">
				<Settings aria-hidden />
			</FloatingBarButton>
		</FloatingBar>
	),
};

/** A button that removes something (`tone="danger"`), and a key combination in the tooltip (`shortcut`). */
export const DangerAndShortcut: Story = {
	render: () => (
		<FloatingBar aria-label="도구">
			<FloatingBarButton label="설정" shortcut={["mod", "."]}>
				<SettingsAdjust aria-hidden />
			</FloatingBarButton>
			<Separator orientation="vertical" length="bar" />
			<FloatingBarButton label="지우기" tone="danger">
				<TrashCan aria-hidden />
			</FloatingBarButton>
		</FloatingBar>
	),
};

/** A tool that cannot be used now. */
export const Disabled: Story = {
	render: () => (
		<FloatingBar aria-label="이미지 도구">
			<FloatingBarButton label="편집" disabled>
				<Edit aria-hidden />
			</FloatingBarButton>
			<FloatingBarButton label="설정">
				<Settings aria-hidden />
			</FloatingBarButton>
		</FloatingBar>
	),
};
