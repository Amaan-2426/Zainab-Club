
import { sendError } from "../http.js";

export function requireAdmin(req, res, next) {
    if (req.session?.isAdmin !== true) {
        return sendError(
            res,
            401,
            "UNAUTHORIZED",
            "Please sign in to access the admin dashboard."
        );
    }

    next();
}
