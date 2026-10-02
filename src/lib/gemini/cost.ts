import pricingData from '../../../prompts/_shared/pricing.json';

interface ModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  unverified?: boolean;
}

const PRICING = pricingData.models as Record<string, ModelPricing>;

export interface CostResult {
  costUsd: number;
  /** True when the pricing entry itself is flagged unverified (see
   * prompts/_shared/pricing.json) — every caller must surface this
   * distinctly (not just print a dollar figure) so a batch total is never
   * mistaken for a real, confirmed budget number. */
  unverified: boolean;
}

/** Computes cost from a versioned, git-tracked pricing table (prompts/_shared/
 * pricing.json) rather than a hardcoded number here — a price change is a
 * diff to that file, not a silent recalculation buried in code. Throws
 * loudly on an unknown model rather than silently returning 0 — a batch
 * run's cost ceiling (see scripts/gemini-author-batch.ts) depends on this
 * being right every time, not just usually right. */
export function computeCost(model: string, tokensIn: number, tokensOut: number): CostResult {
  const pricing = PRICING[model];
  if (!pricing) {
    throw new Error(`No pricing entry for model "${model}" in prompts/_shared/pricing.json — add one before running this model.`);
  }
  const costUsd = (tokensIn / 1_000_000) * pricing.inputPerMillionUsd + (tokensOut / 1_000_000) * pricing.outputPerMillionUsd;
  return { costUsd, unverified: pricing.unverified === true };
}
