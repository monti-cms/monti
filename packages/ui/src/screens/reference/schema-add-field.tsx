import {
	Button,
	FormField,
	FormFieldLabel,
	Input,
	PickList,
	PickListItem,
	Segmented,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSplit,
	SheetTitle,
	Stack,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
	Textarea,
} from "../../index";
import { AdminFrame } from "./frame";
import { SchemaPage } from "./schema";
import { ShownSelect, SwitchOption } from "./settings";

const LOCALIZE = [
	{ value: "same", label: "모두 같음" },
	{ value: "each", label: "언어마다" },
	{ value: "source", label: "원문 따름" },
];

/** Settings, Collections tab, with the add-field sheet open on a relation field. */
export function SchemaAddFieldScreen() {
	return (
		<AdminFrame open="settings" corner={false}>
			<SchemaPage />
			<Sheet open>
				<SheetContent>
					<SheetHeader>
						<SheetTitle
							of={
								<>
									{"· "}
									{"게시글"}
								</>
							}
						>
							필드 추가
						</SheetTitle>
					</SheetHeader>
					<SheetSplit
						list={
							<PickList aria-label="필드 종류">
								<PickListItem>글자</PickListItem>
								<PickListItem>고르기</PickListItem>
								<PickListItem>미디어</PickListItem>
								<PickListItem selected mark="→">
									관계
								</PickListItem>
							</PickList>
						}
					>
						<Tabs value="basic" fill>
							<TabsList variant="bar">
								<TabsTrigger value="basic">기본</TabsTrigger>
								<TabsTrigger value="advanced">고급</TabsTrigger>
							</TabsList>
							<SheetBody>
								<FormField>
									<FormFieldLabel htmlFor="field-label">표시 이름</FormFieldLabel>
									<Input id="field-label" defaultValue="시리즈" />
								</FormField>
								<FormField>
									<FormFieldLabel htmlFor="field-name">이름</FormFieldLabel>
									<Input id="field-name" mono defaultValue="series" />
								</FormField>
								<FormField>
									<FormFieldLabel htmlFor="field-help">도움말</FormFieldLabel>
									<Textarea id="field-help" tall defaultValue="이 글이 속한 연재. 같은 연재 글끼리 앞뒤로 이어 준다." />
								</FormField>
								<FormField>
									<FormFieldLabel htmlFor="field-target">가리킬 컬렉션</FormFieldLabel>
									<ShownSelect id="field-target" value="시리즈" />
								</FormField>
								<SwitchOption label="여러 개 고르기" />
								<SwitchOption label="목록에 없으면 새로 만들기" checked />
								<FormField>
									<FormFieldLabel htmlFor="field-drafts">발행 안 된 시리즈</FormFieldLabel>
									<ShownSelect id="field-drafts" value="고를 수 있음 · 사이트엔 안 보임" />
								</FormField>
								<SwitchOption
									label={
										<>
											{"필수 "}
											{"!"}
										</>
									}
								/>
								<Stack gap={6}>
									<Text variant="micro" tone="subtle">
										언어
									</Text>
									<Segmented aria-label="언어" value="same" onValueChange={() => {}} options={LOCALIZE} />
								</Stack>
							</SheetBody>
						</Tabs>
					</SheetSplit>
					<SheetFooter>
						<Button variant="ghost">취소</Button>
						<Button>필드 추가</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</AdminFrame>
	);
}
