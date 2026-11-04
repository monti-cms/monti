import { Affix, MenuField, PageBody, PageColumn, PageHeader, PageToolbar, Section } from "../../index";
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
						{/* The section's title already says what it is; the field needs no label of its own. */}
						<MenuField aria-label="언어" value="한국어" meta="ko" />
					</Section>
					<Section title="기능">
						<SwitchOption label="본문 템플릿" checked />
						<SwitchOption label="번역" checked />
					</Section>
					<Section title="주소" last>
						{/* The section's title says what the value is; the address alone, read only (it is set in a file). */}
						{/* Set in the config file, so it can be changed here in local development, as the preview path can. */}
						<Affix aria-label="관리자 주소" prefix="/" defaultValue="studio" />
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
