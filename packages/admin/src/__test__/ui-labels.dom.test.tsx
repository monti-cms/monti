import { createSite, SiteProvider } from "@monti-cms/core/site";
import { type UiLabels, useUiLabels } from "@monti-cms/ui/internal";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../core/test/site";
import { KO_UI_LABELS } from "../../../ui/.storybook/ko-labels";
import { AdminUiLabels } from "../ui/labels";

/** The site under test with its admin in Korean, the language Storybook's labels are written in, whatever the site's own admin language. */
const koreanAdmin = createSite({ ...testConfig, admin: { ...testConfig.admin, locale: "ko" } });

describe("the words Storybook gives the components", () => {
	it("are the words the admin gives them in Korean", () => {
		const seen: UiLabels[] = [];
		function Probe() {
			seen.push(useUiLabels());
			return null;
		}
		render(
			<SiteProvider site={koreanAdmin}>
				<AdminUiLabels>
					<Probe />
				</AdminUiLabels>
			</SiteProvider>,
		);
		expect(seen.at(-1)).toEqual(KO_UI_LABELS);
	});
});
