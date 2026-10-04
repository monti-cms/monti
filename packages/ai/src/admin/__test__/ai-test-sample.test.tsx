// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAction } from "../../action";
import { viewOf } from "../../action-view";
import type { AiActionView } from "../../actions";
import { AI_ACTIONS } from "../../registry";
import { missingRequired, SampleInputs, sampleDefaults, sampleFields, sampleRun } from "../ai-test-sample";

afterEach(cleanup);

/** 예시 설정(`test/cms.config.ts`)의 기능을 관리자 화면 모양으로. */
const view = (key: string): AiActionView => {
	const definition = AI_ACTIONS[key];
	if (!definition) throw new Error(`${key} 기능이 없습니다.`);
	return viewOf(resolveAction(key, definition), undefined);
};

const kinds = (feature: AiActionView) =>
	sampleFields(feature, feature.send).map((field) => [field.name, field.kind, field.required]);

describe("AI 화면 시험 칸", () => {
	it("기능 입력마다 종류에 맞는 칸을 만든다(입력 이름을 보지 않는다)", () => {
		// 번역: 원문 MDX와 두 언어. 언어는 기본 언어 → 기본 언어가 아닌 첫 언어로 시작한다.
		const translate = view("translate");
		expect(kinds(translate)).toEqual([
			["block", "mdx", true],
			["from", "locale", true],
			["to", "locale", true],
		]);
		expect(sampleDefaults(translate)).toEqual({ from: "ko", to: "en" });
		// 선택 영역·블록 기능의 필수 입력도 칸이 있다.
		expect(kinds(view("polish"))).toEqual([
			["selection", "mdx", true],
			["title", "text", false],
		]);
		expect(kinds(view("diagramEdit"))).toEqual([
			["block", "mdx", true],
			["title", "text", false],
		]);
		// 보내지 않는 입력은 칸이 없다. 판단 방식은 이미지를 읽지 않는다.
		expect(kinds(view("imageAlt"))).toEqual([
			["image", "image", false],
			["around", "text", false],
		]);
		expect(kinds(view("tags")).map(([name]) => name)).toEqual(["title", "summary", "body"]);
	});

	it("필수 칸이 비면 실행하지 않고, 값으로 실행 입력과 공통 정보를 만든다", () => {
		const translate = view("translate");
		const fields = sampleFields(translate, translate.send);
		const defaults = sampleDefaults(translate);
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

	it("칸 이름은 입력 이름표이고, 고친 값을 입력 이름으로 알린다", () => {
		const polish = view("polish");
		const onChange = vi.fn();
		render(<SampleInputs fields={sampleFields(polish, polish.send)} values={{}} defaults={{}} onChange={onChange} />);
		fireEvent.change(screen.getByLabelText("고칠 글"), { target: { value: "다듬을 글" } });
		expect(onChange).toHaveBeenCalledWith("selection", "다듬을 글");
		expect(screen.getByLabelText("제목").tagName).toBe("TEXTAREA");

		cleanup();
		const translate = view("translate");
		render(
			<SampleInputs
				fields={sampleFields(translate, translate.send)}
				values={{}}
				defaults={sampleDefaults(translate)}
				onChange={onChange}
			/>,
		);
		expect(screen.getByLabelText("원문")).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "원문 언어" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "대상 언어" })).toBeTruthy();
	});
});
