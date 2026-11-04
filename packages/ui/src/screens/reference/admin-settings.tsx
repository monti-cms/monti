import {
	Affix,
	FormField,
	FormFieldLabel,
	MenuField,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	Section,
} from "../../index";
import { AdminFrame } from "./frame";
import { SettingsTabs, SwitchOption } from "./settings";

/** Settings, Admin tab: the admin's own language, its features, its address. */
export function AdminSettingsScreen() {
	return (
		<AdminFrame open="settings">
			<PageColumn>
				<PageHeader title="설정" />
				<PageToolbar>
					<SettingsTabs open="admin" />
				</PageToolbar>
				<PageBody>
					<Section title="언어">
						{/* A small label over the field, as every field on the site tab has, so the tabs read alike. */}
						<FormField>
							<FormFieldLabel htmlFor="ui-locale">화면 언어</FormFieldLabel>
							<MenuField id="ui-locale" value="한국어" meta="ko" />
						</FormField>
					</Section>
					<Section title="기능">
						<SwitchOption label="본문 템플릿" checked />
						<SwitchOption label="번역" checked />
					</Section>
					<Section title="주소" last>
						{/* Set in the config file, so it can be changed here in local development, as the preview path can. */}
						<FormField>
							<FormFieldLabel htmlFor="admin-path">관리자 주소</FormFieldLabel>
							<Affix id="admin-path" prefix="/" defaultValue="studio" />
						</FormField>
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
