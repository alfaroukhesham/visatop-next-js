import type { Metadata } from "next";
import { TrackPageClient } from "@/components/apply/track-page-client";

export const metadata: Metadata = {
  title: "Track application | Visatop",
};

export const dynamic = "force-dynamic";

export default function TrackApplicationPage() {
  return <TrackPageClient />;
}
