import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { slackOnPublish } from "./slack-on-publish";

const test = testServer();
const messages: { url: string; text: string }[] = [];
let slackIsDown = false;
const fakeSlack: typeof fetch = async (url, init) => {
	if (slackIsDown) return new Response("nope", { status: 500 });
	messages.push({ url: String(url), text: JSON.parse(String(init?.body)).text });
	return new Response("ok");
};

const cms = defineConfig({
	schema,
	site: { url: "https://blog.example" },
	plugins: [mdx(), slackOnPublish({ webhookUrl: "https://hooks.slack.test/T1", fetch: fakeSlack })],
	...test.server,
});

beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});

const publishedPost = async (slug: string, title: string) => {
	const service = cms.contentService();
	const draft = await service.createDraft({
		collection: "post",
		slug,
		metadata: { title },
		body: "Hello.",
		format: "mdx",
	});
	return service.publish({ id: draft.id, expectedVersion: draft.version });
};

describe("slack message on publish", () => {
	it("sends one message with the title and the address when a post is published", async () => {
		await publishedPost("hello-slack", "Hello Slack");
		expect(messages).toEqual([
			{ url: "https://hooks.slack.test/T1", text: "Published: Hello Slack https://blog.example/posts/hello-slack" },
		]);
	});

	it("does not announce a draft", async () => {
		const before = messages.length;
		await cms.contentService().createDraft({
			collection: "post",
			slug: "just-a-draft",
			metadata: { title: "Draft" },
			body: "Hello.",
			format: "mdx",
		});
		expect(messages).toHaveLength(before);
	});

	it("retries when Slack is down, and sends the message once when it is back", async () => {
		const before = messages.length;
		slackIsDown = true;
		await publishedPost("slow-slack", "Slow Slack"); // the publish itself succeeds
		expect(messages).toHaveLength(before);

		slackIsDown = false;
		await cms.events.retry({ all: true });
		expect(messages).toHaveLength(before + 1);
		expect(messages.at(-1)?.text).toContain("Slow Slack");

		// A second retry (or a repeated delivery of the same event) sends nothing more.
		await cms.events.retry({ all: true });
		expect(messages).toHaveLength(before + 1);
	});
});
