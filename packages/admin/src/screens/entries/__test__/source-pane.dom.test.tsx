import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { docOf } from "../../../test/mdx";
import { renderWithSite as render } from "../../../test/site";
import { entriesMessages } from "../messages";
import { DocPreview, SourcePane } from "../source-pane";

const t = testSite.createTranslator(entriesMessages);
const tCommon = testSite.createTranslator(commonMessages);

afterEach(cleanup);

/** The read-only body, named by its label (the preview's own, or the source pane's). */
const body = (label = t("sourcePane.preview")) => screen.getByLabelText(label);
const bodyText = (label?: string) => body(label).textContent ?? "";

describe("DocPreview", () => {
	it("TRANS-S3 shows a stored document as the post would show it, read-only", async () => {
		const heading = "제목";
		render(<DocPreview doc={docOf(`## ${heading}\n\n본문 **굵게**\n`)} />);
		await waitFor(() => expect(bodyText()).toContain("본문 굵게"));
		expect(within(body()).getByRole("heading", { name: heading })).toBeInTheDocument();
		expect(body().getAttribute("contenteditable")).toBe("false");
		expect(within(body()).getByRole("strong").textContent).toBe("굵게");
	});

	it("TRANS-S3 shows the new document when it changes", async () => {
		const { rerender } = render(<DocPreview doc={docOf("처음 본문")} />);
		await waitFor(() => expect(bodyText()).toContain("처음 본문"));
		rerender(<DocPreview doc={docOf("바뀐 본문")} />);
		await waitFor(() => expect(bodyText()).toContain("바뀐 본문"));
		expect(bodyText()).not.toContain("처음 본문");
	});

	it("TRANS-S3 does not start over for a document that says the same, with other block ids", async () => {
		const first = docOf("같은 본문");
		const { rerender } = render(<DocPreview doc={first} />);
		await waitFor(() => expect(bodyText()).toContain("같은 본문"));
		const editor = body();
		rerender(<DocPreview doc={docOf("같은 본문")} />);
		expect(body()).toBe(editor);
	});
});

describe("SourcePane", () => {
	it("TRANS-S3 shows the source document under its title, and closes", async () => {
		const onClose = vi.fn();
		render(
			<SourcePane doc={docOf("원문 첫 문단\n\n원문 둘째 문단\n")} locale="ko" title="원문 제목" onClose={onClose} />,
		);
		expect(screen.getByRole("heading", { name: "원문 제목" })).toBeInTheDocument();
		await waitFor(() => expect(bodyText(t("sourcePane.body"))).toContain("원문 둘째 문단"));
		screen.getByRole("button", { name: tCommon("close") }).click();
		expect(onClose).toHaveBeenCalled();
	});
});
