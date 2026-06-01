import { ConfigSidebar } from "@/components/ConfigSidebar";
import { DevicePreview } from "@/components/DevicePreview";

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden">
      <ConfigSidebar />
      <DevicePreview />
    </div>
  );
}
