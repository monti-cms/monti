import type { CmsConfig } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { backupDatabaseName } from "../local-backup";

const siteOf = (name: string, adminPath = "/admin") =>
	createSite({
		...testConfig,
		site: { ...testConfig.site, name },
		admin: { ...testConfig.admin, path: adminPath },
	} as CmsConfig);

describe("the name of a site's recovery database", () => {
	it("WRITE-R4 is made of the site's name and its admin path, so two sites on one origin get two databases", () => {
		expect(backupDatabaseName(siteOf("Blog"))).toBe("cms_backup:Blog/admin");
		expect(backupDatabaseName(siteOf("Blog"))).not.toBe(backupDatabaseName(siteOf("Shop")));
		expect(backupDatabaseName(siteOf("Blog"))).not.toBe(backupDatabaseName(siteOf("Blog", "/studio")));
	});
});
