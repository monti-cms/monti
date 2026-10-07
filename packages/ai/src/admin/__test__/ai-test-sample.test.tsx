// @vitest-environment jsdom
import { SiteProvider } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../test/site";
import { resolveAction } from "../../action";
import { viewOf } from "../../action-view";
import type { AiActionView } from "../../actions";
import { aiRegistryOf } from "../../registry";
import { missingRequired, SampleInputs, sampleDefaults, sampleFields, sampleRun } from "../ai-test-sample";

afterEach(cleanup);

/** Turns an action of the example config (`test/cms.config.ts`) into the admin screen shape. */
const view = (key: string): AiActionView => {
	const definition = aiRegistryOf(testSite).actions[key];
	if (!definition) throw new Error(`Missing action: ${key}`);
	return viewOf(testSite, resolveAction(key, definition), undefined, undefined, definition);
};

const kinds = (feature: AiActionView) =>
	sampleFields(feature, feature.send).map((field) => [field.name, field.kind, field.required]);

describe("AI screen test fields", () => {
	it("creates a field of the matching kind for each action input (ignores the input name)", () => {
		// Translation: source MDX and two languages. The languages start as the default language to the first non-default language.
		const translate = view("translate");
		expect(kinds(translate)).toEqual([
			["block", "mdx", true],
			["from", "locale", true],
			["to", "locale", true],
		]);
		expect(sampleDefaults(testSite, translate)).toEqual({ from: "ko", to: "en" });
		// Required inputs of selection and block actions also have fields.
		expect(kinds(view("polish"))).toEqual([
			["selection", "mdx", true],
			["title", "text", false],
		]);
		expect(kinds(view("diagramEdit"))).toEqual([
			["block", "mdx", true],
			["title", "text", false],
		]);
		// Inputs that are not sent have no field. The decide mode does not read images.
		expect(kinds(view("imageAlt"))).toEqual([
			["image", "image", false],
			["around", "text", false],
		]);
		expect(kinds(view("tags")).map(([name]) => name)).toEqual(["title", "summary", "body"]);
	});

	it("does not run when a required field is empty, and builds the run input and common context from the values", () => {
		const translate = view("translate");
		const fields = sampleFields(translate, translate.send);
		const defaults = sampleDefaults(testSite, translate);
		expect(missingRequired(fields, {}, defaults)).toBe(true);
		expect(missingRequired(fields, { block: "안녕" }, defaults)).toBe(false);
		expect(sampleRun(translate, fields, { block: "안녕", to: "ja" }, defaults)).toEqual({
			input: { block: "안녕", from: "ko", to: "ja" },
			env: { locale: "ja" },
		});

		const image = view("imageAlt");
		const imageFields = sampleFields(image, image.send);
		expect(sampleRun(image, imageFields, { image: "11111111-1111-4111-8111-111111111111" }).input).toEqual({
			image: { mediaId: "11111111-1111-4111-8111-111111111111" },
		});
		expect(sampleRun(image, imageFields, { image: "/images/a.png", around: " " }).input).toEqual({
			image: { src: "/images/a.png" },
		});

		const slug = view("slug");
		expect(sampleRun(slug, sampleFields(slug, slug.send), { title: "제목", current: "old" })).toEqual({
			input: { title: "제목", current: "old" },
			env: { collection: "post" },
		});
	});

	it("field names are input labels, and edited values are reported by input name", () => {
		const polish = view("polish");
		const onChange = vi.fn();
		render(
			<SiteProvider site={testSite}>
				<SampleInputs fields={sampleFields(polish, polish.send)} values={{}} defaults={{}} onChange={onChange} />
			</SiteProvider>,
		);
		fireEvent.change(screen.getByLabelText("고칠 글"), { target: { value: "다듬을 글" } });
		expect(onChange).toHaveBeenCalledWith("selection", "다듬을 글");
		expect(screen.getByLabelText("제목").tagName).toBe("TEXTAREA");

		cleanup();
		const translate = view("translate");
		render(
			<SiteProvider site={testSite}>
				<SampleInputs
					fields={sampleFields(translate, translate.send)}
					values={{}}
					defaults={sampleDefaults(testSite, translate)}
					onChange={onChange}
				/>
			</SiteProvider>,
		);
		expect(screen.getByLabelText("원문")).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "원문 언어" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "대상 언어" })).toBeTruthy();
	});
});
