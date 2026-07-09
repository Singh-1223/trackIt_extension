import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserStoresCollection } from "@/lib/mongodb";
import { validateStore } from "@/lib/validateStore";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized: valid Bearer token required" },
      { status: 401 }
    );
  }

  const collection = await getUserStoresCollection();
  const document = await collection.findOne({ userId });

  if (!document) {
    return NextResponse.json(
      { error: "No store found for this user" },
      { status: 404 }
    );
  }

  return NextResponse.json(document.store, { status: 200 });
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized: valid Bearer token required" },
      { status: 401 }
    );
  }

  const body = await request.json();

  const validation = validateStore(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400 }
    );
  }

  const collection = await getUserStoresCollection();

  await collection.updateOne(
    { userId },
    {
      $set: {
        store: body,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ success: true }, { status: 200 });
}
