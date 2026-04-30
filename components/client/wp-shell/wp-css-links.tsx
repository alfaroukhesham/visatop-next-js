import React from "react";

export function WpCssLinks({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <>
      {urls.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}

export function WpInlineCss({ cssText }: { cssText: string }) {
  if (!cssText.trim()) return null;
  return <style dangerouslySetInnerHTML={{ __html: cssText }} />;
}

