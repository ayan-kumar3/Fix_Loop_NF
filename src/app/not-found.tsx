import Link from "next/link";
import { Compass, Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <SearchX className="h-7 w-7" />
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-brand-700">404</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
        This page isn&apos;t in the loop
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved. Head back to the
        operations center to keep track of what matters.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard">
          <Button className="gap-1.5">
            <Home className="h-4 w-4" /> Operations Center
          </Button>
        </Link>
        <Link href="/map">
          <Button variant="outline" className="gap-1.5">
            <Compass className="h-4 w-4" /> Explore the map
          </Button>
        </Link>
      </div>
    </div>
  );
}
