import { SignUpForm } from "./sign-up-form";
import { isFacebookOAuthConfigured } from "@/lib/social-oauth";

export default function SignUpPage() {
  return <SignUpForm facebookEnabled={isFacebookOAuthConfigured()} />;
}
