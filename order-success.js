
const params = new URLSearchParams(window.location.search);

const orderId = params.get("orderId");
const accessToken = params.get("accessToken");
const subtotal = params.get("subtotalRupees");

const referenceElement = document.getElementById("order-reference");
const totalElement = document.getElementById("order-total");
const statusElement = document.getElementById("payment-status");
const tokenMessage = document.getElementById("access-token-message");

if (!orderId || !accessToken || subtotal === null) {
    referenceElement.textContent = "Order details unavailable";
    totalElement.textContent = "—";
    statusElement.textContent = "Please check your checkout confirmation.";
    tokenMessage.textContent = "No order access details were provided.";
} else {
    referenceElement.textContent = orderId;
    totalElement.textContent = "₹" + subtotal;
    statusElement.textContent =
        "Unpaid — payment has not been collected.";

    tokenMessage.textContent =
        "Your private order access token: " + accessToken +
        ". Save it securely and do not share it publicly.";
}
