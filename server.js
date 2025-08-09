import express from "express";
import prices from "./config.json" assert { type: "json" };
import Razorpay from "razorpay";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Product catalog (amount in paise, 1 INR = 100 paise)
const products = {
    "JEE_MAINS_AITS": { amount: prices.JEE_MAINS_AITS, unlockKey: "UNLOCK_JEE_MAINS_AITS" },
    "JEE_ADVANCE_AITS": { amount: prices.JEE_ADVANCE_AITS, unlockKey: "UNLOCK_JEE_ADVANCE_AITS" }
};

// 🛒 Create Razorpay order
app.post("/create-order", async (req, res) => {
    try {
        const { productId } = req.body;

        if (!products[productId]) {
            return res.status(400).json({ error: "Invalid product ID" });
        }

        const { amount, unlockKey } = products[productId];

        const razorpay = new Razorpay({
            key_id: "rzp_live_WcDsrduUyVLGWQ",
            key_secret: "NiX5haoQcs25BIISm5OXJtx3"
        });

        const order = await razorpay.orders.create({
            amount: amount,
            currency: "INR",
            receipt: `receipt_${productId}_${Date.now()}`
        });

        res.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount,
            unlockKey: unlockKey
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error creating order");
    }
});

// ✅ Start server
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
