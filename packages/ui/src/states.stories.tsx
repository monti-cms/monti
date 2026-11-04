import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Affix } from "./affix";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Chip } from "./chip";
import { Combobox, ComboboxInput } from "./combobox";
import { FilterButton } from "./filter-button";
import { IconButton } from "./icon-button";
import { Settings } from "./icons";
import { Input } from "./input";
import { ListSection, ListSectionRow } from "./list-section";
import { Option } from "./option";
import { Select, SelectTrigger, SelectValue } from "./select";
import { StoryCaption } from "./story-caption";
import { Switch } from "./switch";
import { RowCheck, RowLink, Table, TableBody, TableCell, TableRow } from "./table";
import { TagInput } from "./tag-input";
import { TextButton } from "./text-button";
import { Textarea } from "./textarea";

/**
 * Every basic part in its interaction states side by side: at rest, under the pointer, with keyboard focus, pressed, and off. The pointer, focus and
 * press columns are forced by `storybook-addon-pseudo-states`, so each state can be looked at without moving the mouse (each cell's part is the forced element). The rules are in
 * docs/design/admin/tokens.md (색 › hover).
 */
const meta = {
	title: "Foundations/States",
	parameters: {
		pseudo: {
			hover: [
				".state-hover > *",
				".state-hover [data-slot=chip] > button",
				".state-hover tr",
				".state-hover [data-slot=list-section-row]",
			],
			focus: [".state-focus input"],
			focusVisible: [
				".state-focus > *",
				".state-focus [data-slot=chip] > button",
				".state-focus [data-slot=checkbox]",
				".state-focus [data-slot=row-link]",
			],
			focusWithin: [".state-focus > *"],
			active: [".state-active > *", ".state-active [data-slot=chip] > button", ".state-active tr"],
		},
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const STATES = [
	{ name: "기본", className: "", disabled: false },
	{ name: "hover", className: "state-hover", disabled: false },
	{ name: "포커스", className: "state-focus", disabled: false },
	{ name: "누름", className: "state-active", disabled: false },
	{ name: "비활성", className: "", disabled: true },
] as const;

/** One row: the part's name, then the part drawn once per state. */
function Row({ name, children }: { name: string; children: (disabled: boolean) => ReactNode }) {
	return (
		<tr>
			<th className="py-monti-12 pr-monti-16 text-left align-middle font-normal">
				<StoryCaption>{name}</StoryCaption>
			</th>
			{STATES.map((state) => (
				<td key={state.name} className="px-monti-12 py-monti-12 align-middle">
					<div className={state.className}>{children(state.disabled)}</div>
				</td>
			))}
		</tr>
	);
}

function Sheet({ children }: { children: ReactNode }) {
	return (
		<table className="w-full table-fixed border-collapse">
			<colgroup>
				<col className="w-36" />
			</colgroup>
			<thead>
				<tr>
					<th />
					{STATES.map((state) => (
						<th key={state.name} className="px-monti-12 pb-monti-8 text-left font-normal">
							<StoryCaption>{state.name}</StoryCaption>
						</th>
					))}
				</tr>
			</thead>
			<tbody>{children}</tbody>
		</table>
	);
}

const CATEGORIES = [{ value: "dev", label: "개발" }];

/** Underline fields: a flat tint and a darker rule under the pointer, the ink rule with focus. */
export const Fields: Story = {
	render: () => (
		<Sheet>
			<Row name="Input">{(disabled) => <Input aria-label="제목" defaultValue="첫 번째 글" disabled={disabled} />}</Row>
			<Row name="Select">
				{(disabled) => (
					<Select items={CATEGORIES} disabled={disabled}>
						<SelectTrigger width="full">
							<SelectValue placeholder="카테고리" />
						</SelectTrigger>
					</Select>
				)}
			</Row>
			<Row name="Combobox">
				{(disabled) => (
					<Combobox items={["리액트"]} disabled={disabled}>
						<ComboboxInput placeholder="태그 고르기" />
					</Combobox>
				)}
			</Row>
			<Row name="Affix">
				{(disabled) => <Affix aria-label="경로" prefix="/" defaultValue="preview" disabled={disabled} />}
			</Row>
			<Row name="Textarea">
				{(disabled) => <Textarea aria-label="요약" defaultValue="요약" rows={1} disabled={disabled} />}
			</Row>
			<Row name="TagInput">
				{(disabled) => (
					<TagInput
						aria-label="태그"
						items={["리액트"]}
						onChange={() => {}}
						removeLabel={(item) => `${item} 빼기`}
						disabled={disabled}
					/>
				)}
			</Row>
		</Sheet>
	),
};

/** Checks and switches: only the box (a soft halo) and the track answer, also from the option row. */
export const Choices: Story = {
	render: () => (
		<Sheet>
			<Row name="Checkbox">{(disabled) => <Checkbox aria-label="고르기" checked={false} disabled={disabled} />}</Row>
			<Row name="Checkbox 켜짐">{(disabled) => <Checkbox aria-label="고르기" checked disabled={disabled} />}</Row>
			<Row name="Option">
				{(disabled) => (
					<Option>
						<Checkbox checked={false} disabled={disabled} />
						코드 블록
					</Option>
				)}
			</Row>
			<Row name="Switch">{(disabled) => <Switch aria-label="켜기" checked={false} disabled={disabled} />}</Row>
			<Row name="Switch 켜짐">{(disabled) => <Switch aria-label="켜기" checked disabled={disabled} />}</Row>
		</Sheet>
	),
};

/** Buttons: a filled button's ground a step darker; a text button turns ink with a tint around its words. */
export const Buttons: Story = {
	render: () => (
		<Sheet>
			<Row name="Button 주">{(disabled) => <Button disabled={disabled}>저장</Button>}</Row>
			<Row name="Button 보조">
				{(disabled) => (
					<Button variant="secondary" disabled={disabled}>
						미리보기
					</Button>
				)}
			</Row>
			<Row name="IconButton">
				{(disabled) => (
					<IconButton label="설정" disabled={disabled}>
						<Settings />
					</IconButton>
				)}
			</Row>
			<Row name="TextButton">{(disabled) => <TextButton disabled={disabled}>되돌리기</TextButton>}</Row>
			<Row name="TextButton 밑줄">
				{(disabled) => (
					<TextButton variant="underline" disabled={disabled}>
						편집
					</TextButton>
				)}
			</Row>
			<Row name="FilterButton">{(disabled) => <FilterButton disabled={disabled}>태그</FilterButton>}</Row>
			<Row name="Chip ×">
				{(disabled) => (
					<Chip onRemove={() => {}} removeLabel="빼기" disabled={disabled}>
						상태: 발행됨
					</Chip>
				)}
			</Row>
		</Sheet>
	),
};

/** Rows: a row that can be picked takes the tint and shows its check; a row that only shows stays still. */
export const Rows: Story = {
	render: () => (
		<Sheet>
			<Row name="표 행">
				{(disabled) => (
					<Table container="none">
						<TableBody>
							<TableRow aria-disabled={disabled || undefined}>
								<TableCell>
									<RowCheck checked={false} label="고르기" />
									<RowLink render={<button type="button" disabled={disabled} />}>첫 번째 글</RowLink>
								</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				)}
			</Row>
			<Row name="보기 줄">
				{() => (
					<ListSection title="">
						<ListSectionRow title="Anthropic 개인" actions={<TextButton variant="underline">편집</TextButton>} />
					</ListSection>
				)}
			</Row>
		</Sheet>
	),
};
