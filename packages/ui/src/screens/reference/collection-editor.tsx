import { ChangesGroup, Checkbox, Grid, Inline, Option, Section, Text, TextButton } from "../../index";
import { CollectionSettings } from "./collection-parts";
import { AdminFrame } from "./frame";

const none = () => {};

type Choice = { label: string; checked?: boolean; note?: string };

const blocks: readonly Choice[] = [
	{ label: "체크리스트", checked: true },
	{ label: "인용", checked: true },
	{ label: "코드 블록", checked: true },
	{ label: "표", checked: true },
	{ label: "구분선", checked: true },
	{ label: "이미지", checked: true },
	{ label: "파일", note: "· 변경" },
	{ label: "각주", checked: true },
	{ label: "코드 탐색기", checked: true },
	{ label: "수식", checked: true },
	{ label: "콜아웃", checked: true },
	{ label: "탭", checked: true },
	{ label: "단 나누기", checked: true },
	{ label: "접기", checked: true },
	{ label: "차트" },
	{ label: "다이어그램" },
];

const marks: readonly Choice[] = [
	{ label: "굵게", checked: true },
	{ label: "기울임", checked: true },
	{ label: "밑줄", checked: true },
	{ label: "취소선", checked: true },
	{ label: "코드", checked: true },
	{ label: "링크", checked: true },
	{ label: "위 첨자" },
	{ label: "아래 첨자" },
	{ label: "툴팁", checked: true },
	{ label: "글자 색", checked: true },
];

const headings: readonly Choice[] = [{ label: "H2", checked: true }, { label: "H3", checked: true }, { label: "H4" }];

function Choices({ items, mono }: { items: readonly Choice[]; mono?: boolean }) {
	return (
		// One group of choice rows: each stands at the control height (32px), 4px apart.
		<Grid columns={3} gap={4}>
			{items.map((item) => (
				<Option key={item.label}>
					<Checkbox checked={item.checked ?? false} />
					{mono ? (
						<Text mono tone="inherit">
							{item.label}
						</Text>
					) : (
						item.label
					)}
					{item.note ? (
						<Text variant="meta" tone="warning">
							{item.note}
						</Text>
					) : null}
				</Option>
			))}
		</Grid>
	);
}

/** A collection's editor tab with one change unsaved: the blocks, text styles and heading levels its body allows. */
export function CollectionEditorScreen() {
	return (
		<AdminFrame open="settings">
			<CollectionSettings
				tab="editor"
				save={
					<ChangesGroup
						label="변경 사항"
						listLabel="변경 사항"
						countLabel="1곳"
						items={[{ id: "file", name: "파일", tag: "변경", tone: "warning", onUndo: none }]}
						undoLabel="되돌리기"
						discardLabel="모두 되돌리기"
						onDiscard={none}
						saveLabel="저장하고 적용"
						onSave={none}
					/>
				}
			>
				<Section
					stacked
					dense
					title={
						<Inline gap={12} align="baseline">
							블록
							<TextButton variant="quiet" size="note">
								모두 허용
							</TextButton>
						</Inline>
					}
				>
					<Choices items={blocks} />
				</Section>
				<Section stacked dense title="서식">
					<Choices items={marks} />
				</Section>
				<Section stacked dense title="제목 단계">
					<Choices items={headings} mono />
				</Section>
			</CollectionSettings>
		</AdminFrame>
	);
}
