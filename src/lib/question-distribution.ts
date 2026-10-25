// Cognitive distribution of exam questions (default "analytical" profile requested by the user):
// 80% analytical, 15% deep comprehension, 5% direct facts.
export type QuestionDistribution = {
  analytical: number;
  comprehension: number;
  direct: number;
};

export function distributionCounts(total: number): QuestionDistribution {
  const analytical = Math.round(total * 0.8);
  const comprehension = Math.round(total * 0.15);
  const direct = Math.max(0, total - analytical - comprehension);
  return { analytical, comprehension, direct };
}
