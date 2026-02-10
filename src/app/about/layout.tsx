import { Footer } from "@/components/Footer";

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
