import { openSite } from "@monti-cms/next";
import config from "../monti.config";

// The site's Monti (the admin API runs on it) and the reader its pages read published entries with.
export const { monti, reader } = openSite(config);
