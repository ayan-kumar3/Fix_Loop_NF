"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Upload,
  Camera,
  Eye,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  MapPin,
  Crosshair,
  ArrowRight,
  RotateCcw,
  FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPicker } from "@/components/report/map-picker";
import { toast } from "@/components/toaster";
import { submitReport } from "@/lib/actions/report";
import { ISSUE_CATEGORIES, ISSUE_PRIORITIES, type GeoPoint } from "@/lib/types";
import { validateImageFile, readFileAsDataUrl, compressImage } from "@/lib/image";
import { truncate } from "@/lib/utils";

const DEFAULT_CENTER: { lat: number; lng: number } = { lat: 28.6139, lng: 77.209 };

interface AiResult {
  suggestedCategory: string;
  suggestedPriority: string;
  summary: string;
  visualFindings: string;
  detailedReport: string;
  reason: string;
  confidenceBand: "High" | "Medium" | "Low";
  needsReview: boolean;
  safetyNote: string | null;
}

interface GeocodedLocation {
  point: GeoPoint;
  address: string;
  area: string;
}

type LocationLookupRequest = { query: string } | { point: GeoPoint };

export function ReportForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<{ issueId: string; publicId: string } | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [priority, setPriority] = React.useState("Medium");
  const [address, setAddress] = React.useState("");
  const [area, setArea] = React.useState("");
  const [coords, setCoords] = React.useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = React.useState(DEFAULT_CENTER);
  const [locationLookup, setLocationLookup] = React.useState<"idle" | "loading" | "found" | "not-found" | "error">("idle");
  const [locationMessage, setLocationMessage] = React.useState("");
  const locationRequestId = React.useRef(0);
  const locationControllerRef = React.useRef<AbortController | null>(null);
  const lastForwardLookupRef = React.useRef("");

  const [image, setImage] = React.useState<{
    dataUrl: string;
    base64: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    width: number;
    height: number;
  } | null>(null);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [imageLoading, setImageLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const cameraRequestId = React.useRef(0);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [cameraStarting, setCameraStarting] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const [aiStatus, setAiStatus] = React.useState<"idle" | "loading" | "done" | "error" | "unavailable">("idle");
  const [aiResult, setAiResult] = React.useState<AiResult | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiModel, setAiModel] = React.useState<string>("");
  const analysisRequestId = React.useRef(0);
  const analysisControllerRef = React.useRef<AbortController | null>(null);

  const canAnalyze = description.trim().length >= 10;

  const invalidateAnalysis = () => {
    analysisRequestId.current += 1;
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    setAiResult(null);
    setAiStatus("idle");
    setAiError(null);
  };

  const lookupLocation = async (target: LocationLookupRequest) => {
    const query = "query" in target ? target.query.trim() : "";
    const normalizedQuery = query.toLocaleLowerCase();
    if ("query" in target && (query.length < 3 || lastForwardLookupRef.current === normalizedQuery)) return;
    if ("query" in target) lastForwardLookupRef.current = normalizedQuery;

    locationControllerRef.current?.abort();
    const requestId = ++locationRequestId.current;
    const controller = new AbortController();
    locationControllerRef.current = controller;
    setLocationLookup("loading");
    setLocationMessage("");

    try {
      const params = new URLSearchParams(
        "query" in target
          ? { q: query }
          : { lat: String(target.point.lat), lon: String(target.point.lng) }
      );
      const response = await fetch(`/api/geocode?${params.toString()}`, { signal: controller.signal });
      const data = await response.json() as { location?: GeocodedLocation | null; error?: string };
      if (requestId !== locationRequestId.current) return;
      if (!response.ok) throw new Error(data.error || "Location lookup failed.");
      if (!data.location) {
        setLocationLookup("not-found");
        setLocationMessage("No matching address found. Try a nearby street or landmark.");
        lastForwardLookupRef.current = "";
        return;
      }

      if ("query" in target) {
        setCoords(data.location.point);
        setMapCenter(data.location.point);
      }
      setAddress(data.location.address);
      setArea(data.location.area);
      invalidateAnalysis();
      setLocationLookup("found");
      setLocationMessage("Address and area filled from the selected location.");
    } catch (error) {
      if (controller.signal.aborted || requestId !== locationRequestId.current) return;
      setLocationLookup("error");
      setLocationMessage(error instanceof Error ? error.message : "The address service is temporarily unavailable.");
      lastForwardLookupRef.current = "";
    } finally {
      if (locationControllerRef.current === controller) locationControllerRef.current = null;
    }
  };

  const cancelLocationLookup = () => {
    locationRequestId.current += 1;
    locationControllerRef.current?.abort();
    locationControllerRef.current = null;
    lastForwardLookupRef.current = "";
    setLocationLookup("idle");
    setLocationMessage("");
  };

  const handleMapPick = (point: GeoPoint) => {
    setCoords(point);
    void lookupLocation({ point });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationLookup("error");
      setLocationMessage("Location access is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCoords(point);
        setMapCenter(point);
        void lookupLocation({ point });
      },
      () => {
        setLocationLookup("error");
        setLocationMessage("Could not access your location. Check browser permissions or choose a place on the map.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  React.useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  React.useEffect(
    () => () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      locationControllerRef.current?.abort();
    },
    []
  );

  const processImageFile = async (file: File) => {
    if (!file) return;
    setImageError(null);
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setImageError(validation.error ?? "This photo cannot be used.");
      return;
    }

    invalidateAnalysis();
    setImageLoading(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const compressed = await compressImage(raw, { maxDim: 1280, quality: 0.82 });
      if (compressed.dataUrl.length > 4_000_000) {
        setImageError("This photo is still too large after compression. Please choose a smaller image.");
        return;
      }
      setImage({
        dataUrl: compressed.dataUrl,
        base64: compressed.base64,
        mimeType: compressed.mimeType,
        width: compressed.width,
        height: compressed.height,
      });
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Could not process this photo.");
    } finally {
      setImageLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (file) void processImageFile(file);
  };

  const openCamera = async () => {
    setCameraError(null);
    setCameraOpen(true);
    setCameraStarting(true);
    const requestId = cameraRequestId.current + 1;
    cameraRequestId.current = requestId;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not available in this browser. Use a secure localhost or HTTPS page.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      if (cameraRequestId.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch (err) {
      const errorName = err instanceof DOMException ? err.name : "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Allow camera access in your browser settings, then try again.");
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setCameraError("No camera was found on this device. You can choose a photo from your device instead.");
      } else {
        setCameraError(err instanceof Error ? err.message : "The camera could not be opened.");
      }
    } finally {
      setCameraStarting(false);
    }
  };

  const closeCamera = () => {
    cameraRequestId.current = 0;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraStarting(false);
    setCameraOpen(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError("The camera preview is not ready yet. Please wait a moment and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("The photo could not be captured. Please try again or choose a photo from your device.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setCameraError("The photo could not be captured. Please try again.");
      return;
    }

    closeCamera();
    await processImageFile(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
  };

  const runAnalysis = async () => {
    analysisControllerRef.current?.abort();
    const requestId = ++analysisRequestId.current;
    setAiStatus("loading");
    setAiError(null);
    const controller = new AbortController();
    analysisControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const requestBody = {
        description: description.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(category ? { category } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(area.trim() ? { area: area.trim() } : {}),
        ...(image ? { imageDataBase64: image.base64, mimeType: image.mimeType } : {}),
      };
      const res = await fetch("/api/ai/analyze-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      const data = await res.json();
      if (requestId !== analysisRequestId.current) return;
      if (res.status === 503 && data.available === false) {
        setAiStatus("unavailable");
        setAiError(data.error);
        return;
      }
      if (!res.ok) {
        setAiStatus("error");
        setAiError(data.error || "Analysis failed.");
        return;
      }
      if (!data.analysis) {
        setAiStatus("error");
        setAiError("The analysis response was incomplete. Please retry.");
        return;
      }
      setAiResult(data.analysis);
      setAiModel(data.model || "gemini");
      setAiStatus("done");
      toast({ title: "Analysis complete", description: "Review suggestions before submitting.", variant: "success" });
    } catch (err) {
      if (requestId === analysisRequestId.current) {
        setAiStatus("error");
        setAiError(err instanceof Error && err.name === "AbortError"
          ? "The analysis took too long. Please try again."
          : err instanceof Error
            ? err.message
            : "Network error.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (analysisControllerRef.current === controller) analysisControllerRef.current = null;
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (document.activeElement?.id === "address") {
      e.stopPropagation();
      void lookupLocation({ query: address });
      return;
    }
    setFormError(null);

    if (!title.trim() || title.trim().length < 5) return setFormError("Please enter a title (at least 5 characters).");
    if (description.trim().length < 15) return setFormError("Please describe the issue (at least 15 characters).");
    if (!category) return setFormError("Please choose an issue category.");
    if (!address.trim()) return setFormError("Please provide a location.");

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        address: address.trim(),
        area: area.trim() || undefined,
        coordinates: coords,
        mediaUrl: image?.dataUrl ?? null,
        aiAnalysis:
          aiStatus === "done" && aiResult
            ? {
                ...aiResult,
                model: aiModel,
              }
            : undefined,
      };
      const res = await submitReport(payload);
      if (!res.ok) {
        setFormError(res.error || "Submission failed.");
        setSubmitting(false);
        return;
      }
      setSuccess({ issueId: res.issueId!, publicId: res.publicId! });
      toast({ title: "Report submitted", description: `${res.publicId} is now in the queue.`, variant: "success" });
    } catch (err) {
      setFormError("Something went wrong submitting your report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="mx-auto max-w-2xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader className="items-center pt-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <CardTitle className="mt-4 text-2xl">Your report is in the queue</CardTitle>
          <CardDescription>Thanks for helping improve your community. You can follow this report as it moves toward resolution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pb-8 text-center">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report reference</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900">{success.publicId}</p>
          </div>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" onClick={() => router.push("/reports")}>
              View reports <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Submit another report
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDownCapture={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).id === "address") {
          e.preventDefault();
          e.stopPropagation();
          void lookupLocation({ query: address });
        }
      }}
      className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"
    >
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="report-step-number flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">01</span>
              <div>
                <p className="report-step-label mb-1 text-[10px] font-bold uppercase tracking-[0.16em]">Step 1 of 3</p>
                <CardTitle>What&apos;s the problem?</CardTitle>
              </div>
            </div>
            <CardDescription>Describe the issue clearly so it can be triaged quickly.</CardDescription>
          </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Issue title *</Label>
                <Input id="title" value={title} onChange={(e) => { setTitle(e.target.value); invalidateAnalysis(); }} placeholder="e.g. Pothole near the main entrance" maxLength={140} />
                <p className="text-xs text-slate-400">{title.length}/140</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={description} onChange={(e) => { setDescription(e.target.value); invalidateAnalysis(); }} placeholder="What is wrong, where exactly?" rows={5} maxLength={4000} />
                <p className="text-xs text-slate-400">{description.length}/4000</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={(v: string) => { setCategory(v); invalidateAnalysis(); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v: string) => setPriority(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="report-step-number flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">02</span>
                <div>
                  <p className="report-step-label mb-1 text-[10px] font-bold uppercase tracking-[0.16em]">Step 2 of 3</p>
                  <CardTitle>Add a photo & analyse with AI</CardTitle>
                </div>
              </div>
              <CardDescription>A picture helps triage. Optionally let Gemini suggest a category and priority.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="hidden" />
              {image ? (
                <div className="relative overflow-hidden rounded-lg border">
                  <Image
                    src={image.dataUrl}
                    alt="Preview"
                    width={image.width}
                    height={image.height}
                    unoptimized
                    className="max-h-64 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      invalidateAnalysis();
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="neutral" className="bg-white/90">Ready to analyse</Badge>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imageLoading}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"
                >
                  {imageLoading ? <Loader2 className="h-6 w-6 animate-spin text-brand-600" /> : <Upload className="h-6 w-6 text-slate-400" />}
                  <span className="text-sm font-medium text-slate-700">Choose a photo from your device</span>
                  <span className="text-xs text-slate-400">JPG, PNG or WEBP · up to 8MB</span>
                </button>
              )}
              {!image && (
                <Button type="button" variant="outline" className="w-full" onClick={() => void openCamera()} disabled={imageLoading}>
                  <Camera className="h-4 w-4" /> Take picture from camera
                </Button>
              )}
              {imageError && (
                <p className="flex items-center gap-1 text-xs text-danger">
                  <AlertCircle className="h-3.5 w-3.5" /> {imageError}
                </p>
              )}

              <div className="report-ai-panel rounded-xl border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="report-ai-accent h-4 w-4" />
                    <span className="report-ai-heading text-sm font-semibold">Analyze with Gemini AI</span>
                    {aiStatus === "done" && <Badge className="report-ai-badge" variant="info">{aiModel}</Badge>}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={runAnalysis} disabled={!canAnalyze || imageLoading || aiStatus === "loading"}>
                    {aiStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiStatus === "done" ? "Re-analyse" : "Analyze with AI"}
                  </Button>
                </div>
                {!canAnalyze && <p className="report-ai-muted mt-2 text-xs">Write at least a short description to enable analysis.</p>}

                {aiStatus === "error" && (
                  <div className="mt-3 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                    <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-4 w-4" /> {aiError}</p>
                    <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 px-2 text-danger" onClick={runAnalysis}>
                      <RotateCcw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  </div>
                )}

                {aiStatus === "unavailable" && (
                  <div className="mt-3 rounded-md border border-warn/30 bg-warn/5 p-3 text-sm text-warn">
                    <p className="flex items-center gap-1.5 font-medium"><FileWarning className="h-4 w-4" /> AI is unavailable</p>
                    <p className="report-ai-copy mt-1 text-xs">{aiError} You can still submit this report manually — nothing is blocked.</p>
                  </div>
                )}

                {aiStatus === "done" && aiResult && (
                  <div className="report-ai-result mt-3 space-y-4 rounded-lg border p-4 shadow-sm">
                    <div className="report-ai-visual grid gap-3 rounded-md border p-3 sm:grid-cols-[144px_1fr] sm:items-center">
                      {image ? (
                        <Image
                          src={image.dataUrl}
                          alt="Photo analyzed by Gemini"
                          width={image.width}
                          height={image.height}
                          unoptimized
                          className="aspect-video h-full max-h-24 w-full rounded object-cover"
                        />
                      ) : (
                        <div className="report-ai-no-image flex aspect-video items-center justify-center rounded">
                          <Eye className="h-6 w-6" aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <div className="report-ai-label flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          {image ? "What Gemini sees" : "Visual analysis"}
                        </div>
                        <div className="report-ai-copy mt-1 text-sm leading-6">{aiResult.visualFindings}</div>
                      </div>
                    </div>
                    <div className="report-ai-summary rounded-md p-3">
                      <div className="report-ai-label text-xs font-semibold uppercase tracking-wide">Report summary</div>
                      <div className="report-ai-copy mt-1 text-sm leading-6">{aiResult.summary}</div>
                    </div>
                    <div>
                      <div className="report-ai-label text-xs font-semibold uppercase tracking-wide">Detailed report</div>
                      <div className="report-ai-copy mt-1 whitespace-pre-line text-sm leading-6">{aiResult.detailedReport}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="report-ai-metric rounded-md p-3">
                        <div className="report-ai-label text-xs">Suggested category</div>
                        <div className="report-ai-value font-semibold">{aiResult.suggestedCategory}</div>
                      </div>
                      <div className="report-ai-metric rounded-md p-3">
                        <div className="report-ai-label text-xs">Suggested priority</div>
                        <div className="report-ai-value font-semibold">{aiResult.suggestedPriority}</div>
                      </div>
                    </div>
                    <div>
                      <div className="report-ai-label text-xs font-semibold uppercase tracking-wide">Priority reasoning</div>
                      <div className="report-ai-copy mt-1 text-sm leading-6">{aiResult.reason}</div>
                    </div>
                    {aiResult.safetyNote && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <span className="font-semibold">Safety note:</span> {aiResult.safetyNote}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge className="report-ai-badge" variant="info">{aiResult.confidenceBand} confidence</Badge>
                      {aiResult.needsReview && <Badge variant="warn">Needs human review</Badge>}
                    </div>
                    <div className="report-ai-actions flex flex-col gap-2 border-t pt-3 sm:flex-row">
                      <Button className="report-ai-action" type="button" size="sm" onClick={() => { setDescription(aiResult.detailedReport); setCategory(aiResult.suggestedCategory); setPriority(aiResult.suggestedPriority); }}>
                        Use full report & suggestions
                      </Button>
                      <Button className="report-ai-action-secondary" type="button" size="sm" variant="outline" onClick={() => setDescription(aiResult.detailedReport)}>
                        Use report as description
                      </Button>
                    </div>
                    <p className="report-ai-muted text-[11px]">AI suggestions can be imperfect. Review and edit the report before submitting.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="report-step-number flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">03</span>
                <div>
                  <p className="report-step-label mb-1 text-[10px] font-bold uppercase tracking-[0.16em]">Step 3 of 3</p>
                  <CardTitle>Where is it?</CardTitle>
                </div>
              </div>
              <CardDescription>Drop a pin and add a short address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="address">Address / landmark *</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => { cancelLocationLookup(); setAddress(e.target.value); invalidateAnalysis(); }}
                    onBlur={() => void lookupLocation({ query: address })}
                    placeholder="e.g. Main St & 1st Ave"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="area">Area / zone</Label>
                  <Input id="area" value={area} onChange={(e) => { setArea(e.target.value); invalidateAnalysis(); }} placeholder="e.g. Market Quarter" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Pin on map *</span>
                <Button type="button" variant="ghost" size="sm" onClick={handleUseMyLocation}>
                  <Crosshair className="h-4 w-4" /> Use my location
                </Button>
              </div>
              <div className="h-72 overflow-hidden rounded-lg border">
                <MapPicker value={coords} onChange={handleMapPick} center={[mapCenter.lat, mapCenter.lng]} zoom={16} />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
                <MapPin className="h-3.5 w-3.5" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — search an address above or click the map to fill the address and area.
              </p>
              {locationLookup !== "idle" && (
                <p className={`text-xs ${locationLookup === "error" || locationLookup === "not-found" ? "text-danger" : "text-slate-500"}`} aria-live="polite">
                  {locationLookup === "loading" ? "Finding this location…" : locationMessage}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Review & submit</CardTitle>
              <CardDescription>Confirm the details below, then submit your report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0">
                <span className="text-slate-500">Title</span>
                <span className="text-right font-medium text-slate-800">{truncate(title, 46)}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0">
                <span className="text-slate-500">Category</span>
                <span className="text-right font-medium text-slate-800">{truncate(category, 46)}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0">
                <span className="text-slate-500">Priority</span>
                <span className="text-right font-medium text-slate-800">{priority}</span>
              </div>
              <div className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0">
                <span className="text-slate-500">Location</span>
                <span className="text-right font-medium text-slate-800">{truncate(address, 46)}</span>
              </div>

              {formError && (
                <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{formError}</div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
              <p className="text-center text-[11px] text-slate-400">
                By submitting you agree to community guidelines. Your report will be tracked to resolution.
              </p>
            </CardContent>
          </Card>
        </div>
        <Dialog
          open={cameraOpen}
          onOpenChange={(open) => {
            if (!open) closeCamera();
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Take a photo</DialogTitle>
              <DialogDescription>Allow camera access, frame the issue, then capture a photo to attach to your report.</DialogDescription>
            </DialogHeader>
            <div className="relative flex h-[38vh] min-h-[180px] w-full max-h-[420px] items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              {cameraStream ? (
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
              ) : (
                <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-white">
                  {cameraStarting && <Loader2 className="h-8 w-8 animate-spin text-blue-300" />}
                  {cameraError && <AlertCircle className="h-8 w-8 text-amber-300" />}
                  <p className="text-sm leading-6 text-white/80">
                    {cameraError ?? "Connecting to your camera…"}
                  </p>
                  {cameraError && (
                    <Button type="button" variant="outline" onClick={() => void openCamera()} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                      <RotateCcw className="h-4 w-4" /> Try camera again
                    </Button>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCamera}>Cancel</Button>
              <Button type="button" onClick={() => void capturePhoto()} disabled={!cameraStream || cameraStarting}>
                <Camera className="h-4 w-4" /> Capture photo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
  );
}