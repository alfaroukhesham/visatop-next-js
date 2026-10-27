"use client";

import dynamic from "next/dynamic";
import type { FC } from "react";

const ResumeDraftModal = dynamic(
  () =>
    import("@/components/apply/resume-draft-modal").then((mod) => ({
      default: mod.ResumeDraftModal,
    })),
  { ssr: false },
);

const ClientAppHeader = dynamic(
  () =>
    import("@/components/client/client-app-header").then((mod) => ({
      default: mod.ClientAppHeader,
    })),
  { ssr: false },
);

/**
 * Guest first paint does not need the resume dialog or auth chrome.
 * Keep them off the server HTML and out of the initial JS parse.
 */
export const HomeDeferredShell: FC = () => {
  return (
    <>
      <ResumeDraftModal />
      <ClientAppHeader hideWhenSignedOut />
    </>
  );
};
