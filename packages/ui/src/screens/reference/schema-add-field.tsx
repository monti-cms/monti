import {
	Button,
	PickList,
	PickListItem,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetSplit,
	SheetTitle,
	Stack,
} from "../../index";
import { FieldAbout, PickRule, REQUIRED, SwitchRule } from "./field-sheet-parts";
import { AdminFrame } from "./frame";
import { SchemaPage } from "./schema";

/**
 * Settings, Collections tab, with the add-field sheet open on a relation field: the kinds on the left, then the same sheet as a saved field's —
 * the identifier, the label and the description; what it picks from (고를 대상); the rules (입력 규칙).
 */
export function SchemaAddFieldScreen() {
	return (
		<AdminFrame open="settings" corner={false}>
			<SchemaPage />
			<Sheet open>
				<SheetContent>
					<SheetHeader>
						<SheetTitle of="· 게시글" ofMono={false}>
							필드 추가
						</SheetTitle>
					</SheetHeader>
					<SheetSplit
						list={
							<PickList aria-label="필드 종류">
								<PickListItem>글자</PickListItem>
								<PickListItem>고르기</PickListItem>
								<PickListItem>미디어</PickListItem>
								<PickListItem selected>관계</PickListItem>
							</PickList>
						}
					>
						<SheetBody>
							<FieldAbout name="series" label="시리즈" about="이 글이 속한 연재. 같은 연재 글끼리 앞뒤로 이어 준다." />
							<SheetSection title="고를 대상">
								<Stack gap={4}>
									<PickRule label="가리킬 컬렉션" value="시리즈" />
									<SwitchRule label="여러 개 고르기" />
									<SwitchRule label="목록에 없으면 새로 만들기" checked />
								</Stack>
							</SheetSection>
							<SheetSection title="입력 규칙">
								<Stack gap={4}>
									<SwitchRule label={REQUIRED} />
									<PickRule label="언어" value="언어 공통" />
								</Stack>
							</SheetSection>
						</SheetBody>
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
