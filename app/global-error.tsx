"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {error.message || "We couldn't load the application."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
