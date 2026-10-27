import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Affix } from "../affix";
import { Checkbox } from "../checkbox";
import { Chip } from "../chip";
import { Input } from "../input";
import { UiLabelsProvider } from "../labels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";
import { Switch } from "../switch";
import { Textarea } from "../textarea";

/** The controls with a `proposal` state show it in blue; assistive technology gets the same fact in words, from the one label. */
describe("proposal state, in words", () => {
	const controls: Record<string, (proposal: boolean) => React.ReactNode> = {
		Input: (proposal) => <Input aria-label="field" proposal={proposal} />,
		Textarea: (proposal) => <Textarea aria-label="field" proposal={proposal} />,
		Affix: (proposal) => <Affix aria-label="field" proposal={proposal} />,
		Checkbox: (proposal) => <Checkbox aria-label="field" proposal={proposal} />,
		Switch: (proposal) => <Switch aria-label="field" proposal={proposal} />,
		Select: (proposal) => (
			<Select defaultValue="a">
				<SelectTrigger aria-label="field" proposal={proposal}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">A</SelectItem>
				</SelectContent>
			</Select>
		),
	};

	for (const [name, control] of Object.entries(controls)) {
		it(`describes a ${name} the assistant filled, and only that one`, () => {
			const { rerender } = render(control(true));
			expect(screen.getByLabelText("field").getAttribute("aria-description")).toBe("AI suggestion");
			rerender(control(false));
			expect(screen.getByLabelText("field").hasAttribute("aria-description")).toBe(false);
		});
	}

	it("takes the words from the app's labels", () => {
		render(
			<UiLabelsProvider labels={{ proposal: "AI 제안" }}>
				<Input aria-label="field" proposal />
				<Chip proposal>React</Chip>
			</UiLabelsProvider>,
		);
		expect(screen.getByLabelText("field").getAttribute("aria-description")).toBe("AI 제안");
		expect(screen.getByText("AI 제안").className).toContain("sr-only");
	});

	it("says it in text inside a chip, which is not a control", () => {
		const { rerender } = render(<Chip proposal>React</Chip>);
		expect(screen.getByText("AI suggestion").className).toContain("sr-only");
		rerender(<Chip>React</Chip>);
		expect(screen.queryByText("AI suggestion")).toBeNull();
	});
});
