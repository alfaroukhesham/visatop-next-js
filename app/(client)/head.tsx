export default async function Head() {
  // CSS is inserted via `useServerInsertedHTML` from `app/(client)/layout.tsx`
  // so that we can inline extracted + scoped shell styles without interfering
  // with Next's global CSS pipeline.
  return null;
}

