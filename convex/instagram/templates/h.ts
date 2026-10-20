// Mini "JSX" para satori: árboles de { type, props } sin depender de React.
export type El = { type: string; props: Record<string, unknown> };
export type Child = El | string | null | undefined | false;
export type Style = Record<string, string | number>;

export function h(type: string, props: { style?: Style; [k: string]: unknown }, ...children: Child[]): El {
  const kids = children.filter((c): c is El | string => Boolean(c));
  return { type, props: { ...props, children: kids.length === 1 ? kids[0] : kids } };
}

export const div = (style: Style, ...children: Child[]) => h("div", { style: { display: "flex", ...style } }, ...children);
