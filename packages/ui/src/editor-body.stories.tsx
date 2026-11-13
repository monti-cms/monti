import type { Meta, StoryObj } from "@storybook/react-vite";
import { CHECK_MARK_PATH, EditorBody } from "./index";

/** The editor's text column: the plain elements the editor engine draws, in the body's looks, with its states. */
const meta = {
	title: "Monti/EditorTools/EditorBody",
	component: EditorBody,
	parameters: { layout: "padded" },
} satisfies Meta<typeof EditorBody>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The box the editor puts at a checklist item's start (`data-check`, the pressable place, with the drawn `data-check-box`), as the editor draws it. */
const CheckBox = () => (
	<span data-check="" contentEditable={false}>
		<span data-check-box="">
			<svg
				viewBox="0 0 14 14"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				className="size-3.5"
				aria-hidden="true"
			>
				<path d={CHECK_MARK_PATH} />
			</svg>
		</span>
	</span>
);

const Column = ({ children }: { children: React.ReactNode }) => (
	<div className="max-w-monti-reading">
		<EditorBody>
			<div className="ProseMirror">{children}</div>
		</EditorBody>
	</div>
);

/** Every core block once: headings, a paragraph with marks, the three lists, a quote, code, a table and the divider. */
export const Blocks: Story = {
	render: () => (
		<Column>
			<h2>무엇을 덜어냈나</h2>
			<p>
				블로그를 다시 만들기로 한 건 <strong>도구를 고치는 시간</strong>이 길어졌기 때문이다. <a href="#a">지난 글</a>
				에서
				<code>render</code> 이야기를 했다.
			</p>
			<h3>목록</h3>
			<ul>
				<li>첫 번째 요점</li>
				<li>두 번째 요점</li>
			</ul>
			<ol>
				<li>준비물</li>
				<li>단계</li>
			</ol>
			<ul data-checklist="">
				<li data-checked="">
					<CheckBox />
					초안 쓰기
				</li>
				<li>
					<CheckBox />
					발행하기
				</li>
			</ul>
			<h4>인용과 코드</h4>
			<blockquote>
				<p>적게 만들고 오래 쓴다.</p>
			</blockquote>
			<pre>
				<code>{'const doc = { type: "doc", blocks: [] };'}</code>
			</pre>
			<div>
				<hr />
			</div>
			<table>
				<tbody>
					<tr>
						<th>이름</th>
						<th>값</th>
					</tr>
					<tr>
						<td>폭</td>
						<td>680</td>
					</tr>
				</tbody>
			</table>
		</Column>
	),
};

/**
 * The states the editor marks: the empty line under the cursor, the block whose menu is open, a block turned off, a block shown as a box, and two
 * blocks picked whole.
 */
export const States: Story = {
	render: () => (
		<Column>
			<p>문단 하나.</p>
			<ul>
				<li data-menu-open="">메뉴가 열린 항목</li>
				<li>다음 항목</li>
			</ul>
			<h4 data-off="" data-off-label="끈 블록">
				컬렉션이 더는 내놓지 않는 제목 4
			</h4>
			<div data-box="" data-box-label="알 수 없는 블록 · callout" />
			<p data-empty="" data-placeholder="/ 를 눌러 블록 넣기" />
			<div data-picking="">
				<p data-picked="">통째로 고른 문단 하나.</p>
				<p data-picked="">함께 고른 다음 문단.</p>
			</div>
		</Column>
	),
};
