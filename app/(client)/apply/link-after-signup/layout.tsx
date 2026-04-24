import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Linking your application",
  robots: { index: false, follow: false },
};

export default function LinkAfterSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
