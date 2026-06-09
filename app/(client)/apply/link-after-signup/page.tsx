import type { Metadata } from "next";
import { LinkAfterSignupClient } from "./link-after-signup-client";

export const metadata: Metadata = {
  title: "Linking your application",
  description: "Connecting your visa application to your new Visatop account after sign-up.",
};

export default function LinkAfterSignupPage() {
  return <LinkAfterSignupClient />;
}
