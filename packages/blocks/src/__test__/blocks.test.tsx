import { CmsAdminComponentsProvider, useCmsAdminComponents } from "@monti-cms/admin";
import { defineCollection, defineConfig, fields } from "@monti-cms/core";
import { render, screen, waitFor } from "@testing-library/react";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { blocks, callout, color, DEFAULT_TEXT_PALETTE } from "..";
import { ChartProvider } from "../chart/provider";
import { MermaidProvider } from "../mermaid/provider";

const names = (plugins: readonly { name: string }[]) => plugins.map((plugin) => plugin.name);

describe("blocks()", () => {
	it("한 번에 모든 블록 확장을 넣는다(글자 꾸밈은 툴팁 → 코드 연결 → 글자색 순서)", () => {
		expect(names(blocks())).toEqual([
			"callout",
			"collapsible",
			"tabs",
			"columns",
			"mermaid",
			"chart",
			"tooltip",
			"code-ref",
			"color",
		]);
		// 하나씩 만든 확장과 같다.
		expect(blocks({ only: ["callout"] })[0]?.blocks).toEqual(callout().blocks);
	});

	it("고르거나(`only`) 빼고(`omit`·`false`) 확장별 옵션을 넘긴다", () => {
		expect(names(blocks({ only: ["tooltip", "color"] }))).toEqual(["tooltip", "color"]);
		expect(names(blocks({ omit: ["chart", "mermaid"], codeRef: false }))).toEqual([
			"callout",
			"collapsible",
			"tabs",
			"columns",
			"tooltip",
			"color",
		]);
		const palette = [DEFAULT_TEXT_PALETTE[0]].filter((item) => item !== undefined);
		const [colorPlugin] = blocks({ only: ["color"], color: { palette } });
		expect(colorPlugin?.options).toEqual({ palette });
		expect(colorPlugin?.options).toEqual(color({ palette }).options);
		expect(() => blocks({ only: ["nope" as never] })).toThrow(/unknown block extension "nope"/);
	});

	it("사이트 설정에 펼쳐 넣으면 블록이 더해지고, 틀린 옵션은 설정 오류다", () => {
		const post = defineCollection({ label: "Post", kind: "document", fields: { title: fields.text({ label: "T" }) } });
		const base = { collections: { post }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" } as const;
		expect(() => defineConfig({ ...base, plugins: [...blocks()] })).not.toThrow();
		expect(() =>
			defineConfig({
				...base,
				plugins: [
					...blocks({
						color: {
							palette: [
								{ id: "x", name: "x", fg: { light: "red", dark: "#fff" }, bg: { light: "#fff", dark: "#000" } },
							],
						},
					}),
				],
			}),
		).toThrow(/hex/);
		// 같은 확장을 두 번 넣으면 설정 오류다.
		expect(() => defineConfig({ ...base, plugins: [...blocks(), callout()] })).toThrow();
	});
});

/** 등록된 펜스 미리보기를 불러와 이름(컴포넌트 이름)을 보인다. */
function LoadedPreview({ lang }: { lang: string }) {
	const load = useCmsAdminComponents().fencePreviews?.[lang];
	const [component, setComponent] = useState<ComponentType<{ source: string }> | null>(null);
	useEffect(() => {
		void load?.().then((loaded) => setComponent(() => loaded));
	}, [load]);
	return <p>{load ? (component ? `${lang}: ${component.name}` : `${lang}: loading`) : `${lang}: none`}</p>;
}

describe("편집기 미리보기", () => {
	const SitePreview = () => null;

	it("Mermaid·차트 확장이 기본 미리보기를 등록하고, 미리보기를 열 때 렌더러를 불러온다", async () => {
		render(
			<MermaidProvider>
				<ChartProvider>
					<LoadedPreview lang="mermaid" />
					<LoadedPreview lang="chart" />
				</ChartProvider>
			</MermaidProvider>,
		);
		// 렌더러 모듈을 처음 불러오는 시간이 길어 기다리는 시간을 늘린다.
		await waitFor(() => expect(screen.getByText("mermaid: MermaidPreview")).toBeTruthy(), { timeout: 15_000 });
		await waitFor(() => expect(screen.getByText("chart: ChartPreview")).toBeTruthy(), { timeout: 15_000 });
	}, 30_000);

	it("사이트가 같은 이름으로 넣은 미리보기(안쪽 공급자)가 이긴다", async () => {
		const Site = ({ children }: { children: ReactNode }) => (
			<CmsAdminComponentsProvider components={{ fencePreviews: { chart: async () => SitePreview } }}>
				{children}
			</CmsAdminComponentsProvider>
		);
		render(
			<ChartProvider>
				<Site>
					<LoadedPreview lang="chart" />
				</Site>
			</ChartProvider>,
		);
		await waitFor(() => expect(screen.getByText("chart: SitePreview")).toBeTruthy());
	});
});
