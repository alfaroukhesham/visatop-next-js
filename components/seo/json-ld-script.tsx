import { serializeJsonLd } from "@/lib/seo/json-ld";

type JsonLdScriptProps = {
  data: unknown;
  id?: string;
};

export function JsonLdScript({ data, id }: JsonLdScriptProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
