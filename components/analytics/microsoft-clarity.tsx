import type { FC, ReactElement } from "react";
import Script from "next/script";
import { buildClarityBootstrapScript } from "@/lib/analytics/clarity-bootstrap";
import { getClarityProjectId } from "@/lib/analytics/clarity-project-id";

interface IMicrosoftClarityProps {
  projectId?: string;
}

/**
 * Loads Microsoft Clarity on the customer shell only (not admin / API).
 * Do not set Script id="clarity" — Clarity also uses that id internally.
 */
export const MicrosoftClarity: FC<IMicrosoftClarityProps> = (props): ReactElement | null => {
  const projectId = props.projectId ?? getClarityProjectId();
  if (!projectId) return null;

  return (
    <Script
      id="visatop-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: buildClarityBootstrapScript(projectId) }}
    />
  );
};
