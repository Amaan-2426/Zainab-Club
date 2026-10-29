
import { Router } from "express";
import crypto from "node:crypto";
import { sendError, sendOk } from "../http.js";

export const adminAuthRouter = Router();

function verifyPassword(password, storedHash) {
    const parts = storedHash.split(":");

    if (parts.length !== 3 || parts[0] !== "scrypt") {
        return false;
    }

    const [, salt, expectedHex] = parts;

    if (
        !/^[a-f0-9]{32}$/i.test(salt) ||
        !/^[a-f0-9]{128}$/i.test(expectedHex)
    ) {
        return false;
    }

    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");

    return crypto.timingSafeEqual(actual, expected);
}

adminAuthRouter.post("/login", (req, res) => {
    const email = process.env.ADMIN_EMAIL || "";
    const storedHash = process.env.ADMIN_PASSWORD_HASH || "";

    const submittedEmail = req.body?.email;
    const password = req.body?.password;

    if (!email || !storedHash || !process.env.SESSION_SECRET) {
        return sendError(
            res,
            503,
            "ADMIN_NOT_CONFIGURED",
            "Admin login is not configured on the server."
        );
    }

    if (
        typeof submittedEmail !== "string" ||
        typeof password !== "string" ||
        submittedEmail.length > 254 ||
        password.length > 1024
    ) {
        return sendError(
            res,
            400,
            "INVALID_INPUT",
            "Enter a valid email address and password."
        );
    }

    let passwordMatches = false;

    try {
        passwordMatches = verifyPassword(password, storedHash);
    } catch {
        return sendError(
            res,
            503,
            "ADMIN_NOT_CONFIGURED",
            "The admin password hash is invalid."
        );
    }

    const emailMatches =
        submittedEmail.trim().toLowerCase() === email.trim().toLowerCase();

    if (!emailMatches || !passwordMatches) {
        return sendError(
            res,
            401,
            "INVALID_CREDENTIALS",
            "Email or password is incorrect."
        );
    }

    req.session.regenerate((error) => {
        if (error) {
            console.error("Admin session error:", error);
            return sendError(
                res,
                500,
                "SESSION_ERROR",
                "Could not start an admin session."
            );
        }

        req.session.isAdmin = true;

        req.session.save((saveError) => {
            if (saveError) {
                console.error("Admin session save error:", saveError);
                return sendError(
                    res,
                    500,
                    "SESSION_ERROR",
                    "Could not save the admin session."
                );
            }

            sendOk(res, {
                authenticated: true,
                message: "Login successful."
            });
        });
    });
});

adminAuthRouter.get("/me", (req, res) => {
    if (req.session?.isAdmin !== true) {
        return sendError(
            res,
            401,
            "UNAUTHORIZED",
            "Please sign in."
        );
    }

    sendOk(res, { authenticated: true });
});

adminAuthRouter.post("/logout", (req, res) => {
    if (!req.session) {
        return sendOk(res, { authenticated: false });
    }

    req.session.destroy((error) => {
        if (error) {
            return sendError(
                res,
                500,
                "SESSION_ERROR",
                "Could not end the admin session."
            );
        }

        res.clearCookie("zainab.admin.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/"
        });

        sendOk(res, { authenticated: false });
    });
});
