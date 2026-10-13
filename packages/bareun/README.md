# @monti-cms/bareun

English | [한국어](README.ko.md)

Bareun spell and sentence checker for the `@monti-cms/core` editor. It checks Korean text, and the API key is chosen on the plugin's "Spell check" page in the admin (Tools) and kept in the central API key store.
The button, underlines and results panel are drawn by the admin package (see "Text checking" in the admin README). This package only provides the server route that calls Bareun and the checker registration.


```ts
// monti.config.ts
import { bareun } from "@monti-cms/bareun";
import { defineConfig } from "@monti-cms/core/server";

export const cms = defineConfig({
	// …
	plugins: [bareun()],
});
```

The server needs a `secret` (`MONTI_SECRET`) so keys can be saved encrypted. Open the "Spell check" page under Tools and pick a saved key or enter a new one
(saved as "Bareun"); it is listed under Settings, API keys. A site that used the environment variable `BAREUN_API_KEY` is moved over by `monti db:migrate`:
its value becomes the key "Bareun" and is chosen once, and the variable is not read after that.

- Once registered, the editor toolbar gets a "Spell check" button. It only appears for Korean text.
- The browser sends only paragraphs to the site route `/api/monti/v1/text-check/bareun`, and that route calls Bareun with the key. The key is never
  sent to the browser. Only admins can call it. Without a chosen key (or when the key was deleted) it returns 503 (`text_check_unavailable`) and does not call Bareun.
- What is sent: only the text of paragraphs (headings, list items, table cells, and so on). Code blocks, formulas and block attributes are left out, and inline code and
  URLs are replaced by the editor with a single `￼` character. Results that touch that spot are dropped.
- Auto check is off by default. The Bareun API is billed by usage (the free quota is about 50,000 words per month). It checks only when the button is pressed,
  and the same paragraph is not sent again.

```ts
bareun({
	baseUrl: "https://api.bareun.ai", // change it for a self-hosted Bareun server
	label: "Bareun spell check", // toolbar button name
	auto: false, // if true, checks only changed paragraphs once typing stops
	customDictNames: ["blog"], // custom dictionaries uploaded to Bareun
	limits: { maxSegments: 100, maxChars: 10_000 }, // amount per request (larger input is split)
});
```

Results are shown in Bareun's smallest fix unit (blocks that merge several fixes are expanded into individual ones). Categories include spacing, standard word, typo and grammar;
spacing, standard word, typo, grammar and word errors are shown as "error", and the rest (sentence polishing, foreign words, confusable words, needs confirmation) as "warning".

Other checkers (LanguageTool and so on) are built separately in the same shape: put a server route (`textCheckRoute`, `@monti-cms/core/plugin/server`) and the browser-side
`remoteTextChecker` (`@monti-cms/core/client`) into the admin extension point `textCheckers`.
