import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { OAuthConsent } from "@/components/auth/OAuthConsent";

export const metadata: Metadata = { title: "Connect an app · Backlog" };

export default function OAuthConsentPage() {
  return (
    <AuthGate>
      <OAuthConsent />
    </AuthGate>
  );
}
