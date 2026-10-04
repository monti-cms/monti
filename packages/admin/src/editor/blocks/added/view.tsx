"use client";

import { type BlockDefinition, createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import type { ReactNode } from "react";
import { useCmsAdminComponents } from "../../../admin-components";
import { cn } from "../../../lib/utils/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select";
import { Switch } from "../../../ui/switch";
import { type FenceEditorMeta, FencePreviewNodeView, LazyFencePreview } from "../fence-preview";
import { blocksMessages } from "../messages";
import {
	AttributeInput,
	BlockSettings,
	BlockSettingsField,
	ContainerToolbar,
	type ContainerValues,
	SELECTED_RING,
	useContainerValues,
	useEditorEditable,
} from "../shared";
import { addedBlockOfNode, isContainer } from "./shared";

const t = createTranslator(blocksMessages);

/** 사이트·블록 확장이 블록에 등록하는 편집 컴포넌트가 받는 값(`CmsAdminComponents.blockEditors`). */
export interface CustomBlockEditorProps {
	readonly definition: BlockDefinition;
	/** 지시자 속성 값. 비운 값(빈 문자열·false)은 저장하지 않는다. */
	readonly values: Readonly<ContainerValues>;
	readonly setValue: (name: string, value: string | boolean) => void;
	/** 컨테이너 블록의 본문 자리. 본문을 둘 곳에 그린다. 한 줄 블록은 `null`. */
	readonly content: ReactNode;
	readonly editable: boolean;
	readonly selected: boolean;
}

/** 속성 하나의 기본 입력(설정 팝오버 안). 선택 값이 있으면 고르는 칸, 참·거짓이면 스위치, 나머지는 글 입력이다. */
function AttributeField({
	name,
	definition,
	values,
	setValue,
	editable,
}: {
	name: string;
	definition: BlockDefinition;
	values: ContainerValues;
	setValue: (name: string, value: string | boolean) => void;
	editable: boolean;
}) {
	const attribute = definition.attributes[name];
	if (!attribute) return null;
	const value = values[name] ?? attribute.defaultValue ?? (attribute.type === "boolean" ? false : "");
	const id = `${definition.name}-${name}`;
	const description = attribute.description ? (
		<p className="text-cms-muted-foreground text-xs">{attribute.description}</p>
	) : null;
	if (attribute.type === "boolean") {
		return (
			<div className="flex flex-col gap-1">
				<label htmlFor={id} className="flex items-center justify-between gap-2">
					<span className="text-cms-muted-foreground">{attribute.label}</span>
					<Switch
						id={id}
						size="sm"
						checked={value === true}
						disabled={!editable}
						onCheckedChange={(checked) => setValue(name, checked)}
					/>
				</label>
				{description}
			</div>
		);
	}
	if (attribute.options) {
		const options = Object.entries(attribute.options).map(([option, label]) => ({ value: option, label }));
		return (
			<BlockSettingsField label={attribute.label} htmlFor={id}>
				<Select
					value={String(value)}
					items={options}
					disabled={!editable}
					onValueChange={(next) => next !== null && setValue(name, String(next))}
				>
					<SelectTrigger id={id} size="sm" className="h-7 w-full text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{description}
			</BlockSettingsField>
		);
	}
	return (
		<BlockSettingsField label={attribute.label} htmlFor={id}>
			<AttributeInput
				id={id}
				value={String(value)}
				readOnly={!editable}
				onCommit={(next) => setValue(name, next)}
				className="h-7 w-full rounded-md border border-cms-input cms-dark:bg-cms-input/30 px-2 text-xs shadow-xs placeholder:text-cms-muted-foreground placeholder:opacity-100 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50"
			/>
			{description}
		</BlockSettingsField>
	);
}

/** 등록한 편집 컴포넌트가 없을 때의 기본 모양: 블록 이름과 그 아래 본문. 속성은 도구 줄의 설정 팝오버에서 고친다. */
function DefaultCustomBlockEditor({ definition, values, setValue, content, editable }: CustomBlockEditorProps) {
	const names = Object.keys(definition.attributes);
	return (
		<>
			{editable && names.length > 0 && (
				<ContainerToolbar label={t("added.toolbar", { label: definition.label })}>
					<BlockSettings>
						{names.map((name) => (
							<AttributeField
								key={name}
								name={name}
								definition={definition}
								values={values}
								setValue={setValue}
								editable={editable}
							/>
						))}
					</BlockSettings>
				</ContainerToolbar>
			)}
			<div
				contentEditable={false}
				className={cn("not-prose px-3 py-2 font-medium text-cms-muted-foreground text-xs", content && "border-b")}
			>
				{definition.label}
			</div>
			{content && <div className="px-3">{content}</div>}
		</>
	);
}

/** 지시자 블록의 기본 NodeView. 등록한 편집 컴포넌트(`blockEditors[블록 이름]`)가 있으면 그것으로 그린다. */
export function CustomBlockNodeView(props: NodeViewProps) {
	const { node, selected, editor } = props;
	const definition = addedBlockOfNode(node.type.name);
	const [values, setValue] = useContainerValues(props);
	const editable = useEditorEditable(editor);
	const { blockEditors } = useCmsAdminComponents();
	if (!definition) return <NodeViewWrapper />;
	const Editor = blockEditors?.[definition.name] ?? DefaultCustomBlockEditor;
	return (
		<NodeViewWrapper
			data-cms-custom-block={definition.name}
			data-cms-framed
			className={cn("group/container relative my-6 rounded-md border", selected && SELECTED_RING)}
		>
			<Editor
				definition={definition}
				values={values}
				setValue={setValue}
				content={isContainer(definition) ? <NodeViewContent /> : null}
				editable={editable}
				selected={selected}
			/>
		</NodeViewWrapper>
	);
}

/** 코드 펜스 블록의 기본 NodeView: 코드 입력 칸과 사이트가 넣은 미리보기(`fencePreviews[언어]`). */
function FenceBlockNodeView(props: NodeViewProps & { readonly definition: BlockDefinition }) {
	const { definition } = props;
	const lang = definition.syntax.kind === "fence" ? definition.syntax.lang : definition.name;
	const meta: FenceEditorMeta = {
		kind: lang,
		label: definition.label,
		placeholder: definition.editor.insert?.code ?? "",
		preview: (value) => (
			<LazyFencePreview
				lang={lang}
				label={definition.label}
				value={value}
				emptyText={definition.editor.placeholder ?? t("added.placeholder", { label: definition.label })}
			/>
		),
	};
	return <FencePreviewNodeView {...props} meta={meta} />;
}

/**
 * 더한 블록의 NodeView. 블록 확장·사이트가 편집 화면 전체(`blockViews[블록 이름]`)를 주면 그것으로, 아니면 코드 펜스
 * 블록은 코드·미리보기 화면, 지시자 블록은 속성·본문 상자로 그린다.
 */
export function AddedBlockNodeView(props: NodeViewProps) {
	const definition = addedBlockOfNode(props.node.type.name);
	const { blockViews } = useCmsAdminComponents();
	if (!definition) return <NodeViewWrapper />;
	const View = blockViews?.[definition.name];
	if (View) return <View {...props} />;
	if (definition.syntax.kind === "fence") return <FenceBlockNodeView {...props} definition={definition} />;
	return <CustomBlockNodeView {...props} />;
}
