import Link from "next/link";
import type { NormalizedWpMenuItem } from "@/lib/wp-headless/types";

function FooterItem({ item }: { item: NormalizedWpMenuItem }) {
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
            <FooterItem key={c.id} item={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WpShellFooter({ menu }: { menu: NormalizedWpMenuItem[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t bg-white py-10 text-sm">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-col gap-6 px-5 sm:px-8">
        <nav aria-label="Footer">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menu.map((item) => (
              <FooterItem key={item.id} item={item} />
            ))}
          </ul>
        </nav>
        <div className="text-muted-foreground">© {year} Visatop</div>
      </div>
    </footer>
  );
}

