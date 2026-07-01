import { sarvamChat } from "../sarvam";

export async function processCareIntent(text: string) {
  const systemPrompt = `You are a Customer Care Agent for a Corrugated Box factory.
Your job is to answer general inquiries about factory capabilities, certifications, and build trust.
We manufacture custom corrugated boxes in Single and Double Wall flutes.
We can print up to 4 colors.
Minimum order quantity is 500 boxes.
If they ask for pricing, tell them you will transfer them to sales.

Customer Message: ${text}
`;

  const completion = await sarvamChat([{ role: "system", content: systemPrompt }]);
  return {
    response: completion.content || "We are a leading manufacturer of corrugated boxes. How can we help your business grow today?",
    stage: "care_active"
  };
}
