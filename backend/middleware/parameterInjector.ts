/**
 * Merges parameter node values into the generation API call.
 * Called by every generation route before hitting Vertex AI.
 */
export function injectParameters(baseParams: any, parameterOverrides: any) {
  return {
    ...baseParams,
    seed: parameterOverrides.seed ?? Math.floor(Math.random() * 999999),
    guidanceScale: parameterOverrides.guidanceStrength ?? 7.5,
    motionIntensity: parameterOverrides.motionIntensity ?? 50,
    cfgScale: parameterOverrides.cfgScale ?? 7
  };
}
