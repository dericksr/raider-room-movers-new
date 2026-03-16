import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Stripe
  const stripe = process.env.STRIPE_SECRET_KEY 
    ? new Stripe(process.env.STRIPE_SECRET_KEY) 
    : null;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables." });
    }

    const { orderId, amount, studentEmail, items } = req.body;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Raider Room Storage Service",
                description: `Order #${orderId} - ${items}`,
              },
              unit_amount: Math.round(amount * 100), // Amount in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: studentEmail,
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/stripe/callback?status=success&orderId=${orderId}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/stripe/callback?status=cancel&orderId=${orderId}`,
        metadata: {
          orderId: orderId,
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stripe/callback", (req, res) => {
    const { status, orderId } = req.query;
    
    res.send(`
      <html>
        <body style="background: #f4f4f4; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
          <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
            <h2 style="margin-bottom: 1rem;">${status === 'success' ? 'Payment Successful!' : 'Payment Cancelled'}</h2>
            <p style="color: #666; margin-bottom: 2rem;">This window will close automatically.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'STRIPE_PAYMENT_STATUS', 
                  status: '${status}', 
                  orderId: '${orderId}' 
                }, '*');
                setTimeout(() => window.close(), 1000);
              } else {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
