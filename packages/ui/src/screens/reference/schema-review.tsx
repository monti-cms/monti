import { ChangesBar } from "../../changes-group";
import {
	Button,
	ChangeGroup,
	ChangeNote,
	RadioGroup,
	RadioItem,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Stack,
	Text,
	TextButton,
} from "../../index";
import { AdminFrame } from "./frame";
import { CHANGED_FIELDS, SchemaPage } from "./schema";
import { ShownSelect } from "./settings";

/** Settings, Collections tab, with the review sheet open over three changes to the post collection. */
export function SchemaReviewScreen() {
	return (
		<AdminFrame open="settings" corner={false}>
			<SchemaPage
				fields={CHANGED_FIELDS}
				changed
				head={<ChangesBar label="바뀐 곳" count={3} discardLabel="모두 되돌리기" saveLabel="저장하고 적용" />}
			/>
			<Sheet open>
				<SheetContent>
					<SheetHeader>
						<SheetTitle
							of={
								<>
									{"· "}
									{"게시글 · 바뀐 곳 3"}
								</>
							}
						>
							검토
						</SheetTitle>
					</SheetHeader>
					<SheetBody blocks>
						<Stack gap={12}>
							<Stack gap={0}>
								<ChangeGroup kind="edit" tag="이름" title="요약" identifier="summary → excerpt">
									<RadioGroup aria-label="요약 값" value="move">
										<RadioItem value="move" label="값 옮기기" hint="148편" />
										<RadioItem value="empty" label="빈 칸으로 시작" />
									</RadioGroup>
								</ChangeGroup>
								<ChangeGroup kind="drop" tag="지움" title="부제" identifier="subtitle">
									<RadioGroup aria-label="부제 값" value="keep">
										<RadioItem value="keep" label="남겨 두기" hint="132편" />
										<RadioItem
											value="move"
											label="다른 필드로 옮기기"
											control={<ShownSelect value="필드" width="choice" />}
										/>
										<RadioItem value="drop" label="값 지우기" />
									</RadioGroup>
									<ChangeNote>값은 글에 남고 사이트에선 안 보여요.</ChangeNote>
								</ChangeGroup>
								<ChangeGroup kind="new" tag="필수" title="글 종류" identifier="format · select">
									<RadioGroup aria-label="빈 글" value="fill">
										<RadioItem
											value="fill"
											label="빈 글 148편 채우기"
											control={<ShownSelect value="메모" width="choice" />}
										/>
										<RadioItem value="leave" label="그대로 두기" />
									</RadioGroup>
									<ChangeNote>그대로 두면 채우기 전엔 발행할 수 없어요.</ChangeNote>
								</ChangeGroup>
							</Stack>
							<Text as="p" variant="note" tone="subtle">
								영향받는 글 · <TextButton variant="underline">첫 번째 글</TextButton>,{" "}
								<TextButton variant="underline">발행 후 고친 글</TextButton> 외 146편
							</Text>
						</Stack>
					</SheetBody>
					<SheetFooter>
						<TextButton>취소</TextButton>
						<Button>적용</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</AdminFrame>
	);
}
