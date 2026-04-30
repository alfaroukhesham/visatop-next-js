import Link from "next/link";
import type { NormalizedWpMenuItem } from "@/lib/wp-headless/types";

function MenuItem({ item }: { item: NormalizedWpMenuItem }) {
  const content =
    item.link.kind === "internal" ? (
      <Link href={item.link.href} className="hover:underline">
        {item.label}
      </Link>
    ) : (
      <a
        href={item.link.href}
        className="hover:underline"
        rel={item.link.href.startsWith("http") ? "noreferrer" : undefined}
        target={item.link.href.startsWith("http") ? "_blank" : undefined}
      >
        {item.label}
      </a>
    );

  return (
    <li className="flex flex-col gap-2">
      {content}
      {item.children.length > 0 ? (
        <ul className="ml-4 flex flex-col gap-2 border-l pl-4">
          {item.children.map((c) => (
            <MenuItem key={c.id} item={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WpShellHeader({ menu }: { menu: NormalizedWpMenuItem[] }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-col gap-4 px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold tracking-tight">
            Visatop
          </Link>
        </div>
        <nav aria-label="Primary">
          <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            {menu.map((item) => (
              <MenuItem key={item.id} item={item} />
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

