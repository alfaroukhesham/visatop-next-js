const DEFAULT_BASE_PATH = "/visa-processing";

function publicAssetHref(path: string): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH?.trim() || DEFAULT_BASE_PATH).replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalized}`;
}

export function HomeDemoVideo() {
  const src = publicAssetHref("/Visatop-demo.mp4");
  const headingId = "home-demo-video-heading";

  return (
    <section className="w-full space-y-6 md:space-y-8" aria-labelledby={headingId}>
      <header className="space-y-3 text-center">
        <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">Quick preview</p>
        <h2
          id={headingId}
          className="font-heading text-foreground text-[clamp(1.5rem,3.2vw,1.875rem)] font-semibold leading-snug tracking-tight"
        >
          See the full application flow
        </h2>
        <p className="text-muted-foreground mx-auto max-w-prose text-base leading-relaxed md:text-lg">
          Follow each step from visa selection to secure payment—and where you track your status after you submit.
        </p>
      </header>

      <figure className="m-0">
        <div className="border-border bg-card overflow-hidden rounded-lg border shadow-[0_8px_32px_rgba(1,32,49,0.08)]">
          <video
            className="bg-muted aspect-video w-full object-cover"
            controls
            playsInline
            preload="metadata"
            aria-labelledby={headingId}
          >
            <source src={src} type="video/mp4" />
          </video>
        </div>
      </figure>
    </section>
  );
}
