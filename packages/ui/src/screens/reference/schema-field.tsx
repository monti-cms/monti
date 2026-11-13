import {
	Button,
	Inline,
	Input,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetTitle,
	Stack,
} from "../../index";
import { FieldAbout, PickRule, REQUIRED, RuleRow, SwitchRule } from "./field-sheet-parts";
import { AdminFrame } from "./frame";
import { SchemaPage } from "./schema";

/**
 * Settings, Collections tab, with a saved field's sheet open (a field row was clicked): the same sheet as adding one, without the kind list. Its
 * kind reads first, then the identifier, the label and the assistant's description; then the rules of what may be typed, each a 32px row; a delete
 * at the foot.
 */
export function SchemaFieldScreen() {
	return (
		<AdminFrame open="settings" corner={false}>
			<SchemaPage />
			<Sheet open>
				<SheetContent>
					<SheetHeader>
						<SheetTitle of="· 게시글" ofMono={false}>
							요약
						</SheetTitle>
					</SheetHeader>
					<SheetBody>
						<FieldAbout
							kind="글자"
							name="summary"
							label="요약"
							about="목록과 검색 결과에 나오는 한 문장. 결론을 먼저."
						/>
						<SheetSection title="입력 규칙">
							<Stack gap={4}>
								<SwitchRule label={REQUIRED} />
								<SwitchRule label="여러 줄" />
								<RuleRow label="최대 글자 수">
									<Input
										aria-label="최대 글자 수"
										mono
										size="md"
										width="number"
										align="end"
										placeholder="제한 없음"
										defaultValue="120"
									/>
								</RuleRow>
								<PickRule label="언어" value="언어 공통" />
							</Stack>
						</SheetSection>
					</SheetBody>
					<SheetFooter>
						<Inline gap={12} grow minWidth={0}>
							<Button variant="ghost-danger">지우기</Button>
						</Inline>
						<Button variant="ghost">취소</Button>
						<Button>저장</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</AdminFrame>
	);
}
