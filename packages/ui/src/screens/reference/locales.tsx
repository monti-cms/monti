import { Close } from "../../icons";
import {
	Box,
	Button,
	DragHandle,
	IconButton,
	LanguageRow,
	LanguageSource,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	Section,
	Stack,
} from "../../index";
import { AdminFrame } from "./frame";
import { SettingsTabs } from "./settings";

/** Settings, Languages tab: the source language and one translation. The list is all the tab holds (doc 12, 2026-11-11: no time zone). */
export function LocalesScreen() {
	return (
		<AdminFrame open="settings">
			<PageColumn>
				<PageHeader title="설정" />
				<PageToolbar>
					<SettingsTabs open="locales" />
				</PageToolbar>
				<PageBody>
					<Section title="콘텐츠 언어" last>
						<Stack gap={0}>
							<Box as="ul">
								<LanguageRow name="한국어" code="ko" handled>
									<LanguageSource flag="원문">
										<Button variant="ghost" size="sm">
											바꾸기
										</Button>
									</LanguageSource>
								</LanguageRow>
								<LanguageRow
									name="English"
									code="en"
									label="영어"
									handled
									handle={<DragHandle aria-label="English 옮기기" />}
								>
									<IconButton label="English 빼기" onClick={() => {}}>
										<Close aria-hidden />
									</IconButton>
								</LanguageRow>
							</Box>
							<Box paddingTop={12}>
								<Button variant="ghost" size="sm">
									+ 언어 추가
								</Button>
							</Box>
						</Stack>
					</Section>
				</PageBody>
			</PageColumn>
		</AdminFrame>
	);
}
