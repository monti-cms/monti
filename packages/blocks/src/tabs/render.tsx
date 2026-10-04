import { Children, isValidElement, type PropsWithChildren, type ReactElement } from "react";
import { TabsView } from "./render.client";

type TabElement = ReactElement<PropsWithChildren<{ label: string }>>;

/** 탭 하나. `Tabs`가 이름과 본문을 읽어 가므로 따로 쓰일 때는 본문만 그린다. */
export function Tab({ children }: PropsWithChildren<{ label?: string }>) {
	return <div className="cms-block-tabs-panel">{children}</div>;
}

/**
 * 탭 묶음. 자식 `Tab`의 이름(`label`)으로 탭 줄을, 본문으로 탭마다의 칸을 만든다. 처음 열 탭(`defaultValue`)은 탭 이름이고
 * 없거나 맞는 탭이 없으면 첫 탭이다. 전환은 클라이언트 컴포넌트(`TabsView`)가 한다.
 */
export function Tabs({ defaultValue, children }: PropsWithChildren<{ defaultValue?: string }>) {
	const tabs = Children.toArray(children).filter(
		(child): child is TabElement =>
			isValidElement(child) && typeof (child.props as { label?: unknown }).label === "string",
	);
	if (tabs.length === 0) return <>{children}</>;
	const labels = tabs.map((tab) => tab.props.label);
	return (
		<TabsView
			labels={labels}
			panels={tabs.map((tab) => tab.props.children)}
			defaultIndex={Math.max(0, labels.indexOf(defaultValue ?? ""))}
		/>
	);
}

/** 탭의 공개 컴포넌트(`@monti-cms/core/render`가 부른다). */
export default () => ({ Tabs, Tab });
