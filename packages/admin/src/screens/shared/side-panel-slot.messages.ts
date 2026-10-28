import { defineMessages } from "@monti-cms/core";

/** Text of the plugin side panel's button and pane. */
export const sidePanelSlotMessages = defineMessages("cms-admin.sidePanelSlot", {
	en: {
		open: ({ label }) => `Open ${label}`,
		close: ({ label }) => `Close ${label}`,
	},
	ko: {
		open: ({ label }) => `${label} 열기`,
		close: ({ label }) => `${label} 닫기`,
	},
});
