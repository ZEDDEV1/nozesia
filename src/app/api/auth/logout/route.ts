import { NextResponse } from "next/server";
import { removeAuthCookie } from "@/lib/auth";
import { successResponse } from "@/lib/api-response";

export async function POST() {
    await removeAuthCookie();
    return NextResponse.json(successResponse(null, "Logout realizado com sucesso"));
}
