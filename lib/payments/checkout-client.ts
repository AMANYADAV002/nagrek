import { confirmCheckout, markCheckoutFailed, startCheckout, type CheckoutConfirm, type CheckoutRequest } from "@/lib/actions/payments";

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay did not load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not reach Razorpay. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export type CheckoutOutcome = Extract<CheckoutConfirm, { ok: true }> | { ok: false; error: string; cancelled?: boolean };

/** Starts a server order, opens Razorpay Checkout (or the dev mock), then confirms server-side. */
export async function runCheckout(request: CheckoutRequest): Promise<CheckoutOutcome> {
  const start = await startCheckout(request);
  if (!start.ok) return start;

  if (start.mode === "mock") {
    return confirmCheckout({ orderId: start.orderId, paymentId: "", signature: "" });
  }

  let Razorpay: RazorpayConstructor;
  try {
    Razorpay = await loadRazorpay();
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  return new Promise<CheckoutOutcome>((resolve) => {
    let lastError: string | null = null;
    const rzp = new Razorpay({
      key: start.keyId,
      order_id: start.orderId,
      amount: start.amountPaise,
      currency: "INR",
      name: "Nagrek",
      description: start.description,
      prefill: start.prefill,
      theme: { color: "#ff7e5f" },
      handler: (response: RazorpaySuccess) => {
        confirmCheckout({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }).then(resolve, () => resolve({ ok: false, error: "We could not confirm the payment. It will be confirmed shortly if money was deducted." }));
      },
      modal: {
        ondismiss: () => {
          if (lastError) void markCheckoutFailed(start.orderId);
          resolve({ ok: false, error: lastError ?? "Payment cancelled", cancelled: !lastError });
        },
      },
    });
    // Razorpay keeps the window open so the user can retry; we only remember the last failure.
    rzp.on("payment.failed", (response) => {
      lastError = response.error?.description ?? "Payment failed";
    });
    rzp.open();
  });
}
