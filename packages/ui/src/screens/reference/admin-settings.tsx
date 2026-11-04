import {
	Box,
	FormField,
	FormFieldLabel,
	Inline,
	MenuField,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	Section,
	Text,
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
						{/* The section's title already says what it is; the field needs no label of its own. */}
						<MenuField aria-label="언어" value="한국어" meta="ko" />
					</Section>
					<Section title="기능">
						<SwitchOption label="본문 템플릿" checked />
						<SwitchOption label="번역" checked />
					</Section>
					<Section title="주소" last>
						<FormField>
							<FormFieldLabel>관리자 주소</FormFieldLabel>
							<Box paddingTop={6}>
								<Inline gap={12} align="baseline">
									<Text mono>/studio</Text>
									<Text variant="micro" tone="faint">
										monti.schema.ts
									</Text>
								</Inline>
							</Box>
						</FormField>
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
