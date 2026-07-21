import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Visatop portal to create, resume, or track your visa application.",
  robots: { index: false, follow: true },
};
import { isFacebookOAuthConfigured } from "@/lib/social-oauth";

export default function SignInPage() {
  return <SignInForm facebookEnabled={isFacebookOAuthConfigured()} />;
}
