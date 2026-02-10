import { CameraFooter } from "@/components/CameraFooter";

export default function CameraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CameraFooter />
    </>
  );
}
