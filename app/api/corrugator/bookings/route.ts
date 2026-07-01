import { NextResponse } from "next/server";
import { getMonthlyBookings, getAllBookings, bookCorrugators, releaseBooking, confirmPayment, completeBooking } from "@/lib/server/corrugator-capacity";
import { getDatabase } from "@/lib/server/database";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");
    const statusParam = url.searchParams.get("status");

    let bookings;
    if (monthParam) {
      bookings = getMonthlyBookings(monthParam);
    } else if (statusParam) {
      bookings = getAllBookings(statusParam);
    } else {
      bookings = getAllBookings();
    }

    // Enrich bookings with customer info
    const db = getDatabase();
    const enriched = bookings.map((b: any) => {
      const enquiry = db.prepare("SELECT * FROM enquiries WHERE id = ?").get(b.enquiry_id) as any;
      return { ...b, enquiry };
    });

    return NextResponse.json({ success: true, bookings: enriched, count: enriched.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, enquiryId, customerId, quantityKg, bookingId } = body;

    switch (action) {
      case "book": {
        if (!enquiryId || !customerId || !quantityKg) {
          return NextResponse.json({ success: false, error: "enquiryId, customerId, and quantityKg required" }, { status: 400 });
        }
        const result = bookCorrugators(enquiryId, customerId, quantityKg);
        return NextResponse.json(result);
      }
      case "release": {
        if (!bookingId) {
          return NextResponse.json({ success: false, error: "bookingId required" }, { status: 400 });
        }
        const ok = releaseBooking(bookingId);
        return NextResponse.json({ success: ok });
      }
      case "confirm_payment": {
        if (!bookingId) {
          return NextResponse.json({ success: false, error: "bookingId required" }, { status: 400 });
        }
        const ok = confirmPayment(bookingId);
        return NextResponse.json({ success: ok });
      }
      case "complete": {
        if (!bookingId) {
          return NextResponse.json({ success: false, error: "bookingId required" }, { status: 400 });
        }
        const ok = completeBooking(bookingId);
        return NextResponse.json({ success: ok });
      }
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

