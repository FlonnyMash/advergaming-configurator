export type AppEnvironment = "dev" | "prod";

export function getAppEnvironmentFromProcess(
  value: string | undefined,
): AppEnvironment {
  return value === "prod" ? "prod" : "dev";
}
