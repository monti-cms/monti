import { ChevronDown, OverflowMenuHorizontal, Spark } from "../icons";
import {
	Box,
	IconButton,
	Image,
	Inline,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanel,
	Stack,
	Text,
} from "../index";

/** 남색 바탕에 노란 해(지어낸 그림): 연 파일의 그림, 격자의 타일과 패널의 미리보기. */
export const SUN = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#24314a"/><circle cx="200" cy="150" r="104" fill="#f2c14e"/></svg>`,
)}`;

/** 패널의 절: 44px 머리(13px 600, 끝에 접기 ▾나 요약)와 그 줄들, 마지막 줄 아래 20px(줄 사이 4px + 16px), 아래 선. */
function PanelSection({ title, end, children }: { title: string; end?: React.ReactNode; children: React.ReactNode }) {
	return (
		<Stack gap={0} paddingX={24} paddingBottom={20} border="bottom">
			<Inline gap={6} align="center" paddingY={12}>
				<Text variant="note" weight="semibold">
					{title}
				</Text>
				<Box grow />
				{end ?? (
					<Text tone="faint">
						<ChevronDown aria-hidden />
					</Text>
				)}
			</Inline>
			<Stack gap={4}>{children}</Stack>
		</Stack>
	);
}

/** 왼쪽 라벨 열(72px, `width-label`)과 값. */
function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<Inline gap={8} align="start">
			<Box width="label" shrink={false} paddingTop={6}>
				<Text variant="note" tone="subtle">
					{label}
				</Text>
			</Box>
			<Box grow minWidth={0}>
				{children}
			</Box>
		</Inline>
	);
}

/** 읽기만 하는 값: 칸과 같은 자리(8px 안)에 흐린 잉크로. */
function ReadValue({ children }: { children: React.ReactNode }) {
	return (
		<Box paddingX={8} paddingY={6}>
			<Text tone="muted">{children}</Text>
		</Box>
	);
}

/** 시안 `media.html`의 오른쪽 패널: 연 파일의 미리보기, 파일(이름 · 폴더 · 대체 글), 정보, 쓰는 곳. */
export function MediaPanel() {
	return (
		<SidePanel
			title="review-square-renamed.png"
			width="side"
			bleed
			closable
			actions={
				<IconButton size="sm" label="더 보기" side="bottom">
					<OverflowMenuHorizontal aria-hidden />
				</IconButton>
			}
		>
			<Box paddingX={24} paddingTop={16} paddingBottom={8}>
				<Image src={SUN} alt="" ratio="photo" radius="md" />
			</Box>
			<PanelSection title="파일">
				<PanelRow label="이름">
					<Input
						size="md"
						aria-label="이름"
						defaultValue="review-square-renamed"
						action={
							<Text variant="caption" tone="faint">
								.png
							</Text>
						}
					/>
				</PanelRow>
				<PanelRow label="폴더">
					<Select
						items={[
							{ value: "root", label: "최상위" },
							{ value: "cover", label: "표지" },
						]}
						defaultValue="root"
					>
						<SelectTrigger size="md" width="full" caret="active" aria-label="폴더">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="root">최상위</SelectItem>
							<SelectItem value="cover">표지</SelectItem>
						</SelectContent>
					</Select>
				</PanelRow>
				<PanelRow label="대체 글">
					<Input
						size="md"
						aria-label="대체 글"
						placeholder="그림 설명 쓰기"
						action={
							<IconButton size="xs" tone="proposal" label="대체 글 쓰기">
								<Spark aria-hidden />
							</IconButton>
						}
					/>
				</PanelRow>
			</PanelSection>
			<PanelSection title="정보">
				<PanelRow label="종류">
					<ReadValue>PNG 이미지</ReadValue>
				</PanelRow>
				<PanelRow label="크기">
					<ReadValue>800×800 · 27KB</ReadValue>
				</PanelRow>
				<PanelRow label="올린 날">
					<ReadValue>2026년 11월 14일</ReadValue>
				</PanelRow>
			</PanelSection>
			<PanelSection
				title="쓰는 곳"
				end={
					<Text variant="caption" tone="faint" mono>
						0
					</Text>
				}
			>
				<Text variant="caption" tone="faint">
					아직 어느 글에도 쓰이지 않았습니다.
				</Text>
			</PanelSection>
		</SidePanel>
	);
}
