import type { FC, ReactElement } from "react";
import Script from "next/script";
import { buildClarityBootstrapScript } from "@/lib/analytics/clarity-bootstrap";
import { getClarityProjectId } from "@/lib/analytics/clarity-project-id";

interface IMicrosoftClarityProps {
  projectId?: string;
}

/**
 * Loads Microsoft Clarity on the customer shell only (not admin / API).
 * Script id must stay `visatop-clarity`. Clarity also claims the bare `clarity` id.
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
