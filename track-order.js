
const form = document.getElementById("track-form");
const result = document.getElementById("track-result");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const orderId = document.getElementById("order-id").value.trim();
    const accessToken = document.getElementById("access-token").value.trim();

    result.textContent = "Looking up your order...";

    try {
        const data = await apiRequest(
            "/orders/" + encodeURIComponent(orderId) +
            "?access_token=" + encodeURIComponent(accessToken)
        );

        const order = data.order;

        result.replaceChildren();

        const heading = document.createElement("h2");
        heading.textContent = "Order Details";
        result.appendChild(heading);

        function addDetail(label, value) {
            const paragraph = document.createElement("p");
            paragraph.textContent = label + ": " + value;
            result.appendChild(paragraph);
        }

        addDetail("Order ID", order.id);
        addDetail("Order Status", order.status);
        addDetail("Payment Status", order.paymentStatus);
        addDetail("Total", "₹" + order.subtotalRupees);
        addDetail(
            "Order Date",
            new Date(order.createdAt).toLocaleString("en-IN")
        );

        const itemsHeading = document.createElement("h3");
        itemsHeading.textContent = "Items Ordered";
        result.appendChild(itemsHeading);

        if (Array.isArray(order.items) && order.items.length > 0) {
            const list = document.createElement("ul");

            order.items.forEach(function (item) {
                const listItem = document.createElement("li");

                let description =
                    item.product_name +
                    " × " + item.quantity +
                    " — ₹" + item.line_total_rupees;

                if (item.size) {
                    description += " | Size: " + item.size;
                }

                if (item.colour) {
                    description += " | Colour: " + item.colour;
                }

                listItem.textContent = description;
                list.appendChild(listItem);
            });

            result.appendChild(list);
        }

        if (order.paymentStatus !== "paid") {
            addDetail(
                "Payment Note",
                "Payment has not been collected. This order is not confirmed as paid."
            );
        }
    } catch (error) {
        console.error("Order tracking error:", error);

        result.textContent =
            error.message ||
            "Unable to retrieve your order. Please check your Order ID and access token.";
    }
});
