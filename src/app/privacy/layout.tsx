import { Footer } from "@/components/Footer";

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
