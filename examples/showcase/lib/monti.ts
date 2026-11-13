import { codeHighlighter } from "@monti-cms/core/code";
import { openSite } from "@monti-cms/next";
import config from "../monti.config";

// The site's Monti (the admin API runs on it) and the reader its pages read published entries with.
export const { monti, reader } = openSite(config);

// The code blocks' colours: the site's themes and languages, opened once. Pages wait for it and hand it to `renderDocument`.
export const code = codeHighlighter(config.codeBlock);
