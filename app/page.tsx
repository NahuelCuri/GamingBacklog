import { AuthGate } from "@/components/auth/AuthGate";
import { LibraryPicker } from "@/components/home/LibraryPicker";

export default function Home() {
  return (
    <AuthGate>
      <LibraryPicker />
    </AuthGate>
  );
}
