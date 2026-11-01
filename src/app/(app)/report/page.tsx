import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ReportForm } from "@/components/report/report-form";
import { Info, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Report an issue" };

export default function ReportPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Report an issue"
        subtitle="Tell us what's wrong and we'll track it to resolution."
      />
      <div className="p-5 lg:p-8">
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <span>
            <strong>Sample data:</strong> the dashboard and map include 44 synthetic Delhi NCR reports for demonstration;
            they are not reports submitted by you. To add a real report, enter its title, description, category, and
            location below, then optionally attach a photo from your device or take one with your camera.
          </span>
        </div>
        <div className="report-ai-callout mb-5 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            Add an optional photo using <strong>Choose from device</strong> or <strong>Take a photo</strong>, then tap{" "}
            <strong>Analyze with AI</strong>. Gemini suggests a category and priority from your description and photo;
            review and edit every suggestion before submitting.
          </span>
        </div>
        <ReportForm />
      </div>
    </div>
  );
}
