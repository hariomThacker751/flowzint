import { sarvamChat } from "../sarvam";

export async function processSupportIntent(text: string, customerId: string) {
  // Mock support lookup
  const systemPrompt = `You are a B2B Customer Support Agent for a Corrugated Box factory.
Your job is to handle post-sales issues like tracking orders, reporting damaged boxes, or delayed shipments.
You should be empathetic, professional, and assure the customer that their issue is being investigated.
Do NOT try to sell them anything.

Customer Message: ${text}
`;

  const completion = await sarvamChat([{ role: "system", content: systemPrompt }]);
  return {
    response: completion.content || "I understand you have an issue. I'm escalating this to our support team and we will get back to you shortly.",
    stage: "support_active"
  };
}
