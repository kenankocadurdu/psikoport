import Link from "next/link";

export default function FormsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col mx-auto max-w-lg w-full pb-20">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
        <Link href="/" className="font-semibold text-lg">
          Psikoport
        </Link>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
