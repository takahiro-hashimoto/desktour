import { Footer } from "@/components/Footer";

export default function DesktourLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
