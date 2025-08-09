const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

const prices = JSON.parse(fs.readFileSync("./config.json"));

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Razorpay instance
const razorpay = new Razorpay({
    key_id: "rzp_live_WcDsrduUyVLGWQ",
    key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

// Create order endpoint
app.post("/create-order", async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId || !prices[productId]) {
            return res.status(400).json({ error: "Invalid product ID" });
        }

        const amountInPaise = prices[productId] * 100;

        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
});

// Root test route
app.get("/", (req, res) => {
    res.send("Razorpay backend is running.");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
