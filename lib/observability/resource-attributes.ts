/**
 * Resource attributes for traces. `deployment.environment` MUST come from
 * `APP_ENV` (staging vs production on the droplet), never `NODE_ENV`.
 */
export const DEFAULT_OTEL_SERVICE_NAME = "visatop-next-js";

export type TOtelResourceAttributes = {
  "service.name": string;
  "service.version": string;
  "deployment.environment": string;
};

const KNOWN_APP_ENVS = new Set(["staging", "production", "development", "test"]);

export const resolveDeploymentEnvironment = (
  env: Record<string, string | undefined> = process.env,
): string => {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv && KNOWN_APP_ENVS.has(appEnv)) return appEnv;
  if (appEnv) return appEnv;
  return "development";
};

export const resolveServiceVersion = (
  env: Record<string, string | undefined> = process.env,
): string => {
  const sha = env.GIT_SHA?.trim() || env.VISATOP_RELEASE_SHA?.trim();
  if (sha) return sha;
  return "unknown";
};

export const resolveServiceName = (
  env: Record<string, string | undefined> = process.env,
): string => {
  const name = env.OTEL_SERVICE_NAME?.trim();
  return name || DEFAULT_OTEL_SERVICE_NAME;
};

export const resolveOtelResourceAttributes = (
  env: Record<string, string | undefined> = process.env,
): TOtelResourceAttributes => ({
  "service.name": resolveServiceName(env),
  "service.version": resolveServiceVersion(env),
  "deployment.environment": resolveDeploymentEnvironment(env),
});
