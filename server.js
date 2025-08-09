const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const prices = require("./config.json");

const app = express();
app.use(cors());
app.use(express.json());

// Razorpay instance with your keys
const razorpay = new Razorpay({
  key_id: "rzp_test_qWfp1ipRAxheMp",
  key_secret: "iR8f6mNoXsISfOEf00HMaRRp"
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
      amount: prices[productId].price, // already in paise
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
