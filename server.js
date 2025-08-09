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
  "JEE_MAINS_AITS": { amount: 49900, unlockKey: "UNLOCK_JEE_MAINS_AITS" },   // ₹499
  "JEE_ADVANCE_AITS": { amount: 99900, unlockKey: "UNLOCK_JEE_ADVANCE_AITS" } // ₹999
};

// ✅ Razorpay live credentials
const razorpay = new Razorpay({
  key_id: "rzp_live_WcDsrduUyVLGWQ",
  key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

// 📌 Create Razorpay order
app.post("/create-order", async (req, res) => {
  try {
    const { productId } = req.body;
    const product = products[productId];

    if (!product) {
      return res.status(400).json({ error: "Invalid product" });
    }

    const options = {
      amount: product.amount,
      currency: "INR",
      receipt: `receipt_${productId}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      productId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Verify payment & return unlock key
app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, productId } = req.body;

  const generated_signature = crypto
    .createHmac("sha256", "NiX5haoQcs25BIISm5OXJtx3") // same as key_secret above
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature) {
    const product = products[productId];
    if (product) {
      return res.json({ success: true, unlockKey: product.unlockKey });
    }
  }

  res.json({ success: false });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
