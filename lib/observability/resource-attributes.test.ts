import { describe, expect, it } from "vitest";
import {
  resolveDeploymentEnvironment,
  resolveOtelResourceAttributes,
  resolveServiceVersion,
} from "./resource-attributes";

describe("resolveDeploymentEnvironment", () => {
  it("uses APP_ENV staging/production, never NODE_ENV", () => {
    expect(
      resolveDeploymentEnvironment({ APP_ENV: "staging", NODE_ENV: "production" }),
    ).toBe("staging");
    expect(
      resolveDeploymentEnvironment({ APP_ENV: "production", NODE_ENV: "development" }),
    ).toBe("production");
  });

  it("does not fall back to NODE_ENV when APP_ENV is unset", () => {
    expect(resolveDeploymentEnvironment({ NODE_ENV: "production" })).toBe("development");
  });
});

describe("resolveServiceVersion", () => {
  it("prefers GIT_SHA from deploy", () => {
    expect(resolveServiceVersion({ GIT_SHA: "abc1234", VISATOP_RELEASE_SHA: "deadbeef" })).toBe(
      "abc1234",
    );
  });

  it("is unknown when no release sha is set", () => {
    expect(resolveServiceVersion({})).toBe("unknown");
  });
});

describe("resolveOtelResourceAttributes", () => {
  it("emits service.name, service.version, and deployment.environment", () => {
    expect(
      resolveOtelResourceAttributes({
        APP_ENV: "staging",
        GIT_SHA: "e18e022",
        OTEL_SERVICE_NAME: "visatop-next-js",
      }),
    ).toEqual({
      "service.name": "visatop-next-js",
      "service.version": "e18e022",
      "deployment.environment": "staging",
    });
  });
});
