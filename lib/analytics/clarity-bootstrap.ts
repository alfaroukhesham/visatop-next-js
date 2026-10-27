/**
 * Standard Microsoft Clarity snippet (manual install).
 * Project id is JSON-encoded so it cannot break out of the string literal.
 */
export const buildClarityBootstrapScript = (projectId: string): string => {
  return `
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(projectId)});
`.trim();
};
