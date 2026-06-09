import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Apply",
  description: "Start or continue your visa application with Visatop.",
};

export default function ApplyIndexPage() {
  redirect("/");
}
