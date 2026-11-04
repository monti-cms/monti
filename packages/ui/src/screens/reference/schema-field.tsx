import {
	Button,
	FormField,
	FormFieldLabel,
	Inline,
	Input,
	ReadValue,
	Segmented,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
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
import { SwitchOption } from "./settings";

const LOCALIZE = [
	{ value: "same", label: "모두 같음" },
	{ value: "each", label: "언어마다" },
	{ value: "source", label: "원문 따름" },
];

/**
 * Settings, Collections tab, with a saved field's sheet open (a field row was clicked): the same sheet as adding one, without the kind list,
 * its name and kind read only, and a delete at the foot.
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
					<Tabs value="basic" fill>
						<TabsList variant="bar" inset="panel">
							<TabsTrigger value="basic">기본</TabsTrigger>
							<TabsTrigger value="advanced">고급</TabsTrigger>
						</TabsList>
						<SheetBody>
							<Stack gap={0}>
								<SheetSection title="보기">
									<FormField>
										<FormFieldLabel htmlFor="field-label">표시 이름</FormFieldLabel>
										<Input id="field-label" defaultValue="요약" />
									</FormField>
									<FormField>
										<FormFieldLabel htmlFor="field-help">도움말</FormFieldLabel>
										<Textarea id="field-help" tall defaultValue="목록과 검색 결과에 나오는 한 문장. 결론을 먼저." />
									</FormField>
								</SheetSection>
								<SheetSection title="구조">
									<ReadValue label="이름">summary</ReadValue>
									<ReadValue label="종류" mono={false}>
										글자 · 120자까지
									</ReadValue>
									<SwitchOption label="필수" />
									<SwitchOption label="제목으로 사용" />
									<Stack gap={6}>
										<Text variant="micro" tone="subtle">
											언어
										</Text>
										<Segmented aria-label="언어" value="each" onValueChange={() => {}} options={LOCALIZE} />
									</Stack>
								</SheetSection>
							</Stack>
						</SheetBody>
					</Tabs>
					<SheetFooter>
						<Inline gap={12} grow minWidth={0}>
							<Button variant="ghost-danger">필드 삭제</Button>
						</Inline>
						<Button variant="ghost">취소</Button>
						<Button>저장</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</AdminFrame>
	);
}
