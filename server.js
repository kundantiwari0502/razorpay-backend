import express from "express";
import Razorpay from "razorpay";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import prices from "./config.json" assert { type: "json" };

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// =============================
// Razorpay setup (Live Keys)
// =============================
const razorpay = new Razorpay({
  key_id: "rzp_live_WcDsrduUyVLGWQ",
  key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

// =============================
// Create Order API
// =============================
app.post("/create-order", async (req, res) => {
  try {
    const { productId } = req.body;
    const product = prices[productId];

    if (!product) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const options = {
      amount: product.price * 100, // Convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({
      orderId: order.id,
      productName: product.name,
      amount: product.price
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================
// Verify Payment API
// =============================
app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const generated_signature = crypto
    .createHmac("sha256", "NiX5haoQcs25BIISm5OXJtx3")
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// =============================
// Server Start
// =============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
