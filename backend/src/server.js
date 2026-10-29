
import session from "express-session";
import { adminAuthRouter } from "./routes/adminAuth.js";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { productsRouter } from "./routes/products.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { sendError } from "./http.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const port = Number(process.env.PORT) || 3000;

const corsOrigin =
    process.env.CORS_ORIGIN ||
    "http://127.0.0.1:5500,http://localhost:5500";

const allowedOrigins = corsOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

// CORS: allow the local frontend to use admin session cookies.
app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Origin not allowed by CORS."));
        },
        credentials: true,
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

app.use(express.json({ limit: "100kb" }));

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32)) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

app.use(
    session({
        name: "zainab.admin.sid",
        secret:
            process.env.SESSION_SECRET ||
            "development-only-secret-change-me",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8,
            path: "/"
        }
    })
);

app.use("/api", healthRouter);
app.use("/api", productsRouter);
app.use("/api", ordersRouter);

app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin", adminRouter);

// Do not expose backend/.env if the site folder is served as static files.
app.use("/backend", function denyBackend(_req, res) {
    sendError(res, 404, "NOT_FOUND", "Not found.");
});

const frontendDir = path.join(__dirname, "..", "..");
app.use(express.static(frontendDir));

app.use(function notFound(_req, res) {
    sendError(res, 404, "NOT_FOUND", "That API route does not exist.");
});

app.use(function errorHandler(err, _req, res, _next) {
    const status = err.status || 500;
    const code = err.code || "SERVER_ERROR";
    const message =
        status >= 500 && status !== 503
            ? "Something went wrong on the server."
            : err.message || "Request failed.";

    console.error(err);
    sendError(res, status, code, message);
});

app.listen(port, function onListen() {
    console.log(`ZAINAB CLUB API running at http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
});
