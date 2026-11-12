import { ChangesBar } from "../../changes-group";
import {
	FormField,
	FormFieldLabel,
	FormFieldWas,
	Input,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	Section,
	Textarea,
} from "../../index";
import { AdminFrame } from "./frame";
import { SettingsTabs, ShownSelect } from "./settings";

/** Settings, Site tab, with the assistant's two proposals waiting beside one change of the admin's: "변경 사항 1 · 제안 2", counted apart. */
export function SettingsProposalScreen() {
	return (
		<AdminFrame open="settings">
			<PageColumn>
				<PageHeader title="설정">
					<ChangesBar
						label="변경 사항"
						count={1}
						proposalsLabel="제안"
						proposalsCount={2}
						discardLabel="모두 되돌리기"
						saveLabel="저장하고 적용"
					/>
				</PageHeader>
				<PageToolbar>
					<SettingsTabs open="site" />
				</PageToolbar>
				<PageBody>
					<Section title="이름">
						<FormField>
							<FormFieldLabel
								htmlFor="site-name"
								changed={{ label: "", undoLabel: "버리기", undoShown: true, tone: "proposal" }}
							>
								사이트 이름
							</FormFieldLabel>
							<Input id="site-name" defaultValue="example.blog" proposal />
							<FormFieldWas>example.dev</FormFieldWas>
						</FormField>
					</Section>
					<Section title="글 쓰는 방식">
						<FormField>
							<FormFieldLabel htmlFor="voice" changed={{ label: "", undoLabel: "되돌리기", undoShown: true }}>
								말투와 규칙
							</FormFieldLabel>
							<Textarea id="voice" rows={3} defaultValue={"‘~다’체로 쓴다. 숫자는 아라비아 숫자로."} />
						</FormField>
					</Section>
					<Section title="공개 주소" last>
						<FormField>
							<FormFieldLabel
								htmlFor="locale-path"
								changed={{ label: "", undoLabel: "버리기", undoShown: true, tone: "proposal" }}
							>
								주소에 언어 표시
							</FormFieldLabel>
							<ShownSelect id="locale-path" value="항상" proposal />
							<FormFieldWas>원문 언어만 빼고</FormFieldWas>
						</FormField>
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
