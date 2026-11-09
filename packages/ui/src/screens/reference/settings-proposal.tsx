import { ChangesBar } from "../../changes-group";
import {
	Affix,
	FormField,
	FormFieldLabel,
	FormFieldWas,
	Input,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	Section,
} from "../../index";
import { AdminFrame } from "./frame";
import { SettingsTabs, ShownSelect, SiteUrl, SwitchOption } from "./settings";

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
					<Section title="이름과 링크">
						<FormField>
							<FormFieldLabel htmlFor="site-name" changed={{ label: "", undoLabel: "되돌리기", undoShown: true }}>
								사이트 이름
							</FormFieldLabel>
							<Input id="site-name" defaultValue="example.dev" />
						</FormField>
						<FormField>
							<FormFieldLabel htmlFor="home">홈 링크</FormFieldLabel>
							<Affix id="home" prefix="/" defaultValue="" />
						</FormField>
					</Section>
					<Section title="미리보기">
						<FormField>
							<FormFieldLabel
								htmlFor="preview"
								changed={{ label: "", undoLabel: "버리기", undoShown: true, tone: "proposal" }}
							>
								미리보기 경로
							</FormFieldLabel>
							<Affix id="preview" prefix="/" defaultValue="draft" proposal />
							<FormFieldWas>/preview</FormFieldWas>
						</FormField>
						<SwitchOption label="미리보기 경로에 언어 넣기" checked height="lg" />
					</Section>
					<Section title="공개 주소" last>
						<FormField>
							<FormFieldLabel
								htmlFor="locale-path"
								changed={{ label: "", undoLabel: "버리기", undoShown: true, tone: "proposal" }}
							>
								주소에 언어 표시
							</FormFieldLabel>
							<ShownSelect id="locale-path" value="기본 언어만 빼고" proposal />
							<FormFieldWas>항상</FormFieldWas>
						</FormField>
						<SiteUrl />
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
