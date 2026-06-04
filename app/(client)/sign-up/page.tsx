import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a Visatop account to upload documents and track your visa or residency application.",
};
import { isFacebookOAuthConfigured } from "@/lib/social-oauth";

export default function SignUpPage() {
  return <SignUpForm facebookEnabled={isFacebookOAuthConfigured()} />;
}
