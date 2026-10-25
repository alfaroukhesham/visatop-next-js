import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const obs = path.join(root, "deploy/observability");

const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const readObs = (rel: string) => readFileSync(path.join(obs, rel), "utf8");

describe("observability stack (self-hosted, opt-in)", () => {
  it("does not publish Grafana/GlitchTip/Kuma on 0.0.0.0", () => {
    const compose = readObs("docker-compose.yml");
    expect(compose).not.toMatch(/-\s+"0\.0\.0\.0:(3030|3040|3050|3080)/);
    expect(compose).toContain("127.0.0.1:3030:3000");
    expect(compose).toContain("127.0.0.1:3040:8000");
    expect(compose).toContain("127.0.0.1:3050:3001");
    expect(compose).toContain("127.0.0.1:3080:3080");
  });

  it("keeps every service under a mem_limit so the collector cannot starve the app", () => {
    const compose = readObs("docker-compose.yml");
    const services = [
      "alloy",
      "prometheus",
      "loki",
      "tempo",
      "grafana",
      "obs-caddy",
      "glitchtip-web",
      "glitchtip-worker",
      "glitchtip-postgres",
      "redis",
      "kuma",
    ];
    for (const name of services) {
      expect(compose, name).toMatch(new RegExp(`${name}:[\\s\\S]*?mem_limit:`));
    }
  });

  it("is profile-gated so compose up without a profile starts nothing critical", () => {
    const compose = readObs("docker-compose.yml");
    expect(compose).toContain('profiles: ["core", "full"]');
    expect(compose).toContain('profiles: ["errors", "full"]');
    expect(compose).toContain('profiles: ["uptime", "full"]');
  });

  it("does not store bcrypt hashes in env.example (dollar signs break compose)", () => {
    const envExample = readObs("env.example");
    expect(envExample).toContain("OBS_BASIC_AUTH_PASSWORD");
    expect(envExample).not.toMatch(/\$2[ayb]\$/);
    expect(readObs("scripts/up.sh")).toContain("caddy hash-password");
  });

  it("configures Alloy for host metrics, cAdvisor, docker logs, Caddy, OTLP, tail sampling, and PII redaction", () => {
    const alloy = readObs("alloy/config.alloy");
    expect(alloy).toContain("prometheus.exporter.unix");
    expect(alloy).toContain("prometheus.exporter.cadvisor");
    expect(alloy).toContain("loki.source.docker");
    expect(alloy).toContain("visatop-edge-prod:2020");
    expect(alloy).toContain("otelcol.receiver.otlp");
    expect(alloy).toContain("otelcol.processor.tail_sampling");
    expect(alloy).toContain('status_codes = ["ERROR"]');
    expect(alloy).toContain("threshold_ms = 2000");
    expect(alloy).toContain("[email]");
    expect(alloy).toContain("[passport]");
    expect(alloy).toContain('name              = "checkout_created_total"');
    expect(alloy).toContain('name              = "webhook_401_total"');
  });

  it("provisions Grafana alerts covering the required failure modes", () => {
    const rules = readObs("grafana/provisioning/alerting/rules.yml");
    for (const title of [
      "Site down",
      "5xx / error spike",
      "Disk usage over 80 percent",
      "Memory usage over 80 percent",
      "Container restarts",
      "Webhook 401s",
      "Unmatched webhooks",
      "OCR error spike",
      "Checkouts without paid payments",
    ]) {
      expect(rules).toContain(`title: ${title}`);
    }
  });

  it("ships a VisaTop health dashboard JSON with a stable uid", () => {
    const dash = JSON.parse(readObs("grafana/dashboards/visatop-health.json")) as {
      uid: string;
      title: string;
      panels: unknown[];
    };
    expect(dash.uid).toBe("visatop-health");
    expect(dash.title).toBe("VisaTop health");
    expect(dash.panels.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps retention in the 15-30 day band", () => {
    const prometheus = readObs("prometheus/prometheus.yml");
    const compose = readObs("docker-compose.yml");
    const loki = readObs("loki/loki.yml");
    const tempo = readObs("tempo/tempo.yml");
    expect(compose).toContain("storage.tsdb.retention.time=15d");
    expect(loki).toContain("retention_period: 360h");
    expect(tempo).toContain("block_retention: 336h");
    expect(prometheus).toContain("visatop-droplet");
  });
});

describe("Dockerfile HEALTHCHECK vs blue-green wait_healthy", () => {
  it("HEALTHCHECK hits the same DB-free path wait_healthy uses", () => {
    const dockerfile = read("Dockerfile");
    const deploy = read("scripts/blue-green-deploy.sh");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/visa-processing/api/health");
    expect(deploy).toContain('"/visa-processing/api/health"');
    expect(deploy).not.toMatch(/State\.Health|Health\.Status|wait-until.*healthy/i);
    expect(deploy).toContain("docker exec");
  });

  it("does not change Caddy routing or slot flip in blue-green-deploy.sh as part of this stack", () => {
    const deploy = read("scripts/blue-green-deploy.sh");
    expect(deploy).toContain("admin 127.0.0.1:2019");
    expect(deploy).toContain("DRAIN_SECONDS=90");
    expect(deploy).toContain("reverse_proxy ${upstream}:3000");
    expect(deploy).toContain("format json");
    expect(deploy).toContain("output stdout");
  });
});

describe("deploy.yml release markers", () => {
  it("bakes GIT_SHA into the image and records Grafana/GlitchTip markers without failing the deploy", () => {
    const workflow = read(".github/workflows/deploy.yml");
    expect(workflow).toContain("GIT_SHA=${{ steps.rev.outputs.sha }}");
    expect(workflow).toContain("APP_ENV=${{ env.ENVIRONMENT }}");
    expect(workflow).toContain("Record deploy markers (optional)");
    expect(workflow).toContain("deploy/observability/scripts/record-deploy-markers.sh");
    const dockerfile = read("Dockerfile");
    expect(dockerfile).toContain("ARG APP_ENV=development");
    expect(dockerfile).toContain("RELEASE_SHA=$GIT_SHA");
    expect(dockerfile).toContain("SENTRY_RELEASE=$GIT_SHA");
    const markers = readObs("scripts/record-deploy-markers.sh");
    expect(markers).toContain("exit 0");
    expect(markers).toContain("/api/annotations");
    expect(markers).toContain("/api/0/organizations/");
  });
});
