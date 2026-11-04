import {
	Box,
	DragHandle,
	FormField,
	FormFieldLabel,
	LanguageRow,
	LanguageSource,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	Section,
	Stack,
	TextButton,
} from "../../index";
import { AdminFrame } from "./frame";
import { SettingsTabs, ShownSelect } from "./settings";

/** Settings, Languages tab: the source language, one translation, the time zone. */
export function LocalesScreen() {
	return (
		<AdminFrame open="settings">
			<PageColumn>
				<PageHeader title="설정" />
				<PageToolbar>
					<SettingsTabs open="locales" />
				</PageToolbar>
				<PageBody>
					<Section title="콘텐츠 언어">
						<Stack gap={0}>
							<Box as="ul">
								<LanguageRow name="한국어" code="ko" handled>
									<LanguageSource flag="원문">
										<TextButton variant="underline" quiet size="note">
											바꾸기
										</TextButton>
									</LanguageSource>
								</LanguageRow>
								<LanguageRow
									name="English"
									code="en"
									label="영어"
									handled
									handle={<DragHandle aria-label="English 옮기기" />}
								>
									<TextButton variant="quiet" aria-label="English 지우기">
										×
									</TextButton>
								</LanguageRow>
							</Box>
							<Box paddingTop={12}>
								<TextButton>+ 언어 추가</TextButton>
							</Box>
						</Stack>
					</Section>
					<Section title="시간대" last>
						<FormField>
							<FormFieldLabel htmlFor="time-zone">시간대</FormFieldLabel>
							<ShownSelect id="time-zone" value="Asia/Seoul" />
						</FormField>
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
