import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = { title: "Wish list" };

export default function WishlistPage() {
  return <WishlistView />;
}
