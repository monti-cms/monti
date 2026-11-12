# @monti-cms/ai

Monti's assistant. The core does not know AI: it has the operations (which become the assistant's tools), the proposals and the keys. This
package brings what calls a model: the run engine, the model providers and the quick tasks.

```ts
import { assistant } from "@monti-cms/ai";
import { defineConfig } from "@monti-cms/core";

export default defineConfig({
	// …
	plugins: [assistant()],
});
```

- **A run** is one request and the turns that answer it: ask the model, run the tools it called, ask again. It is the stream
  `assistant.run` (`POST …/streams/assistant.run`, its events one JSON object per line). Reads run at once; a write becomes an item of a
  proposal and changes nothing until a person applies it; a screen tool goes to the browser, and the run waits for its answer. Everything is
  stored as it goes, so a run cut short (a time limit, a lost connection) goes on from where it was with `resume`.
- **The tools** are the site's operations, the plugins' included (`assistant.tools` lists them). No code here names one: adding an
  operation adds its tool.
- **Quick tasks** (`assistant.fill`) fill one field with one call of the quick-task model: no loop, no tools, nothing stored.
- **Providers.** The engine knows a model service only as `ModelProvider` (one turn with tools, one answer in a fixed shape). The real ones
  are built on the AI SDK (`aiSdkProvider`): Anthropic, OpenAI, Google, OpenRouter and any OpenAI-compatible server, each called with the
  key the keys screen stored. Tests and Storybook use `scriptedProvider`, a model that says what it was told to: no test calls a model.

```ts
import { assistant, scriptedProvider } from "@monti-cms/ai";

const model = scriptedProvider([
	{ calls: [{ name: "entries_query", input: { collection: "post" } }] },
	{ text: "Two posts have no summary." },
]);
createMonti({ db, schema, secret, plugins: [assistant({ provider: model.for })] });
```

The design is in `docs/design/features/10-assistant.md`.
