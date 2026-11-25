import type { FC } from "react";

interface IMessageWithAmountsProps {
  template: string;
  amounts: Record<string, string>;
}

/** Keeps currency amounts in `<bdi>` so Arabic stays RTL around Western digits. */
export const MessageWithAmounts: FC<IMessageWithAmountsProps> = ({ template, amounts }) => {
  const parts = template.split(/(\{(?:unit|sum|price|n|total|promise)\})/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = /^\{(unit|sum|price|n|total|promise)\}$/.exec(part);
        if (!match) return <span key={index}>{part}</span>;
        const name = match[1] ?? "";
        const value = amounts[name] ?? "";
        if (name === "n") return <span key={index}>{value}</span>;
        return <bdi key={index}>{value}</bdi>;
      })}
    </>
  );
};
