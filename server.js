const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const prices = require("./config.json");

const app = express();
app.use(cors());
app.use(express.json());

// Razorpay instance with LIVE keys
const razorpay = new Razorpay({
  key_id: "rzp_live_WcDsrduUyVLGWQ",
  key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

// Root route
app.get("/", (req, res) => {
  res.send("Razorpay backend is running");
});

// Create order route
app.post("/create-order", async (req, res) => {
  try {
    const { productId } = req.body;

    if (!prices[productId]) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const order = await razorpay.orders.create({
      amount: prices[productId].price * 100, // convert Rs to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        product_name: prices[productId].name
      }
    });

    res.json({
      id: order.id,
      currency: order.currency,
      amount: order.amount
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating order");
  }
});

// Webhook route
app.post("/webhook", (req, res) => {
  const secret = "razorpay_webhook_secret"; // set same as in Razorpay dashboard

  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest === req.headers["x-razorpay-signature"]) {
    console.log("✅ Webhook verified:", req.body);

    // Example: Capture successful payment
    if (
      req.body.event === "payment.captured" ||
      req.body.event === "order.paid"
    ) {
      console.log("💰 Payment successful for:", req.body.payload.payment.entity.amount);
      // Add DB update or email logic here
    }
    res.status(200).json({ status: "ok" });
  } else {
    console.warn("❌ Webhook signature verification failed.");
    res.status(400).send("Invalid signature");
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
