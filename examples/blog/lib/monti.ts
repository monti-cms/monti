import { existsSync } from "node:fs";
import { openSite, refreshSite } from "@monti-cms/next";
import config from "../monti.config";

// For the repo's flow tests only: while the file `MONTI_REFRESH_DOWN` names is there, refreshing the site's cached pages fails, as it does
// when the cache cannot be reached, and the delivery is sent again later. A site of your own leaves this out: `openSite(config)` is all of it.
const down = process.env.MONTI_REFRESH_DOWN;
const refresh = down
	? () => {
			if (existsSync(down)) throw new Error("The site's cache is down.");
			refreshSite();
		}
	: undefined;

// The site's Monti (the admin API runs on it) and the reader its pages read published entries with.
export const { monti, reader } = openSite(config, { refresh });
