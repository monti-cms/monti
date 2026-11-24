import type { Meta, StoryObj } from "@storybook/react-vite";
import { DragHandle } from "./drag-handle";
import { FloatingBar, FloatingBarButton } from "./floating-bar";
import { FormatButton } from "./format-bar";
import { Grid } from "./grid";
import { IconButton } from "./icon-button";
import { Add, Close, Link, Spark, TextBold, View } from "./icons";
import {
	ToolList,
	ToolListAdd,
	ToolListHead,
	ToolListItem,
	ToolListSeparator,
	ToolPreview,
	ToolPreviewSelection,
} from "./tool-list";

/** 편집기 도구의 항목 목록과 미리보기(설정 › 관리자). */
const meta = { title: "Patterns/List/ToolList", component: ToolList } satisfies Meta<typeof ToolList>;
export default meta;
type Story = StoryObj<typeof meta>;

const eye = (name: string) => (
	<IconButton size="xs" tone="quiet" label={`${name} 숨기기`}>
		<View aria-hidden />
	</IconButton>
);

/** 항목, 구분선, 끄는 중인 항목, 맨 아래 "+ 구분선 넣기", 옆의 미리보기. */
export const Default: Story = {
	render: () => (
		<Grid columns="preview" gap={24} align="start">
			<ToolList aria-label="서식 막대 항목">
				<ToolListHead>보이는 항목 · 3</ToolListHead>
				<ToolListItem
					handle={<DragHandle aria-label="굵게 옮기기" />}
					icon={<TextBold aria-hidden />}
					name="굵게"
					shortcut="⌘B"
					action={eye("굵게")}
				/>
				<ToolListItem
					held
					handle={<DragHandle aria-label="링크 옮기기" />}
					icon={<Link aria-hidden />}
					name="링크"
					shortcut="⌘K"
					action={eye("링크")}
				/>
				<ToolListSeparator
					handle={<DragHandle aria-label="구분선 옮기기" />}
					action={
						<IconButton size="xs" tone="quiet" label="구분선 빼기">
							<Close aria-hidden />
						</IconButton>
					}
				/>
				<ToolListItem
					handle={<DragHandle aria-label="AI 옮기기" />}
					icon={<Spark aria-hidden />}
					name="AI"
					shortcut="⌘J"
					action={eye("AI")}
				/>
				<ToolListAdd>
					<Add aria-hidden />
					<span>구분선 넣기</span>
				</ToolListAdd>
			</ToolList>
			<ToolPreview
				title="미리보기"
				note="글자를 고르면 뜨는 막대"
				float={
					<FloatingBar aria-label="서식 막대 미리보기">
						<FormatButton mark="bold" label="굵게" />
						<FloatingBarButton label="링크" marked>
							<Link aria-hidden />
						</FloatingBarButton>
						<FloatingBarButton label="AI" tone="proposal">
							<Spark aria-hidden />
						</FloatingBarButton>
					</FloatingBar>
				}
			>
				산책로는 <ToolPreviewSelection>강을 따라 4km</ToolPreviewSelection> 이어집니다.
			</ToolPreview>
		</Grid>
	),
};
