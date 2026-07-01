import { NextResponse } from "next/server";
import { handleCustomerInbound, handleOwnerInbound } from "@/lib/server/webhook";

export const runtime = "nodejs";

/**
 * Test endpoint to simulate ChakraHQ webhooks
 * 
 * POST /api/test/webhook
 * Body: {
 *   type: "customer" | "owner",
 *   phone: string,
 *   name: string,
 *   text: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, phone, name, text } = body;

    if (!type || !phone || !text) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: type, phone, text" },
        { status: 400 }
      );
    }

    if (type !== "customer" && type !== "owner") {
      return NextResponse.json(
        { ok: false, error: "Invalid type. Must be 'customer' or 'owner'" },
        { status: 400 }
      );
    }

    // Create a simulated ChakraHQ webhook payload
    const simulatedPayload = {
      event: "message",
      payload: {
        from: phone,
        messageId: `test_${Date.now()}`,
        message: {
          from: phone,
          id: `msg_${Date.now()}`,
          type: "text",
          text: {
            body: text
          }
        },
        contacts: [
          {
            profile: {
              name: name || "Test User"
            }
          }
        ]
      }
    };

    const rawBody = JSON.stringify(simulatedPayload);

    // Process through the appropriate webhook handler
    let result;
    try {
      if (type === "customer") {
        result = await handleCustomerInbound(rawBody, null);
      } else {
        result = await handleOwnerInbound(rawBody, null);
      }
    } catch (handlerError) {
      console.error("Webhook handler error:", handlerError);
      return NextResponse.json({
        ok: false,
        error: handlerError instanceof Error ? handlerError.message : "Webhook handler failed",
        stack: handlerError instanceof Error ? handlerError.stack : undefined,
        type,
        simulatedPayload
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      type,
      simulatedPayload,
      result: result.body
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : "Webhook test failed",
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to show usage instructions
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/test/webhook",
    description: "Simulate ChakraHQ webhooks for testing",
    usage: {
      method: "POST",
      body: {
        type: "customer | owner",
        phone: "string (e.g., 919876543210)",
        name: "string (optional)",
        text: "string (message content)"
      }
    },
    examples: {
      customer: {
        type: "customer",
        phone: "919876543210",
        name: "Test Customer",
        text: "Hi, I need 24 inch bags"
      },
      owner: {
        type: "owner",
        phone: "919408724777",
        name: "Production Team",
        text: "The meter weight for 24 inch Regular quality is 3.2g"
      }
    }
  });
}

