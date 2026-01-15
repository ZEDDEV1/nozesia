import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { User, UserRole } from "@prisma/client";

const _jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;

// Fail fast if no secret is configured - critical for security
if (!_jwtSecret) {
    throw new Error("FATAL: JWT_SECRET or NEXTAUTH_SECRET must be configured in environment variables");
}

// TypeScript now knows this is definitely a string
const JWT_SECRET: string = _jwtSecret;

const COOKIE_NAME = "auth-token";

export interface JWTPayload {
    userId: string;
    email: string;
    role: UserRole;
    companyId: string | null;
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return null;
    }
}

export async function setAuthCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
    });
}

export async function getAuthCookie(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function removeAuthCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
    const token = await getAuthCookie();
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { company: true },
    });

    return user;
}

export async function requireAuth(): Promise<User> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error("Unauthorized");
    }
    return user;
}

export async function requireRole(roles: UserRole[]): Promise<User> {
    const user = await requireAuth();
    if (!roles.includes(user.role)) {
        throw new Error("Forbidden");
    }
    return user;
}
