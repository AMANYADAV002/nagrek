import type { Metadata } from "next";
import { Guard } from "@/components/guard";
import { PaymentSuccess } from "@/components/plans/payment-success";

export const metadata: Metadata = { title: "Payment successful" };

export default function PaymentSuccessPage() {
  return (
    <Guard need="plan">
      <PaymentSuccess />
    </Guard>
  );
}
