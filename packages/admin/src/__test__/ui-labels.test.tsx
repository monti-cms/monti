import { SiteProvider } from "@monti-cms/core/site";
import { type UiLabels, useUiLabels } from "@monti-cms/ui/internal";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import { KO_UI_LABELS } from "../../../ui/.storybook/ko-labels";
import { AdminUiLabels } from "../ui/labels";

describe("the words Storybook gives the components", () => {
	it("are the words the admin gives them in Korean", () => {
		expect(testSite.ADMIN_LANGUAGE, "the test site's admin language").toBe("ko");
		const seen: UiLabels[] = [];
		function Probe() {
			seen.push(useUiLabels());
			return null;
		}
		render(
			<SiteProvider site={testSite}>
				<AdminUiLabels>
					<Probe />
				</AdminUiLabels>
			</SiteProvider>,
		);
		expect(seen.at(-1)).toEqual(KO_UI_LABELS);
	});
});
