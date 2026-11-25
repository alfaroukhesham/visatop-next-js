import type { FC, ReactNode } from "react";

interface IMessageWithAmountsProps {
  template: string;
  amounts: Record<string, string>;
}

/** Keeps currency amounts in `<bdi>` so Arabic stays RTL around Western digits. */
export const MessageWithAmounts: FC<IMessageWithAmountsProps> = ({ template, amounts }) => {
  const parts = template.split(/(\{(?:unit|sum|price|n|total|promise)\})/g);
  const nodes: ReactNode[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const match = /^\{(unit|sum|price|n|total|promise)\}$/.exec(part);
    if (!match) {
      if (part) nodes.push(<span key={index}>{part}</span>);
      continue;
    }
    const name = match[1] ?? "";
    const value = amounts[name] ?? "";
    if (name !== "n") {
      nodes.push(<bdi key={index}>{value}</bdi>);
      continue;
    }
    const next = parts[index + 1] ?? "";
    const word = /^(\s+)(\S+)/.exec(next);
    if (!word?.[2]) {
      nodes.push(<span key={index}>{value}</span>);
      continue;
    }
    nodes.push(
      <span key={index} className="whitespace-nowrap">
        {value}
        {"\u00a0"}
        {word[2]}
      </span>,
    );
    const rest = next.slice(word[0].length);
    if (rest) nodes.push(<span key={`${index}-rest`}>{rest}</span>);
    index += 1;
  }
  return <>{nodes}</>;
};
