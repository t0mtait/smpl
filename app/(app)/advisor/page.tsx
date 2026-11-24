import { redirect } from "next/navigation";

// The AI Advisor now lives under Inventory.
export default function AdvisorRedirect() {
  redirect("/items/advisor");
}
