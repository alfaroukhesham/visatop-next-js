import { SignInForm } from "./sign-in-form";
import { isFacebookOAuthConfigured } from "@/lib/social-oauth";

export default function SignInPage() {
  return <SignInForm facebookEnabled={isFacebookOAuthConfigured()} />;
}
