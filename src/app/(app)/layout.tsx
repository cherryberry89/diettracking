import { AppProvider } from "@/components/app-context";
import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppProvider>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-5 md:pb-10 md:pl-60 md:pr-6 md:pt-8 lg:max-w-4xl">
        {children}
      </main>
    </AppProvider>
  );
}
