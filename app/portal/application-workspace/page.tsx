import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CloudDownload,
  CreditCard,
  FileScan,
  Lock,
  Upload,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = {
  title: "Application workspace | Unified Hybrid Portal",
};

export default function ApplicationWorkspacePage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="bg-card border-border sticky top-0 z-10 flex h-16 w-full shrink-0 items-center border-b px-6">
        <Link
          href="/portal/client-dashboard"
          className="text-foreground hover:text-primary mr-6 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="size-5" />
          <span className="hidden sm:inline">Back to Dashboard</span>
        </Link>
        <div className="bg-border mx-2 hidden h-6 w-px sm:block" />
        <div className="flex items-center gap-3">
          <div className="text-primary size-5">
            <svg
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            Application Workspace
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <ThemeToggle />
          <div className="border-border relative size-8 overflow-hidden rounded-full border">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIOnsKYY2HOCR6zM9yL8GGUEW78kQWO9huoKK__X7hJ2j9ywqrINvCOe0W6a4-R6_x_e8oyLwZ72bMZkvnYDkiwHwkYlGNgYOZDZ0gkGOrem4IR8JYNjsBr-CsiowwgURLG_9LwuAJ6OZNWN5aLanaMMkcw-8rPrVV2XoxiWZUdt3dJZEfOfLlvwYG107bDu2S5HOsNqRNbjrwGQx2ZQYClR4Ef8BU3BDowB9iWaQgOSVM6I0Ak-HTnG7HTh28YuZSzX8FbZ7fHhc"
              alt=""
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
        <div className="w-full space-y-10 overflow-y-auto p-6 lg:w-[60%] lg:p-10">
          <section className="space-y-2">
            <h2 className="text-foreground text-2xl font-bold">
              Document Submission
            </h2>
            <p className="text-muted-foreground max-w-2xl text-base">
              Upload a clear, high-resolution scan or photo of your passport
              data page. Our system will automatically extract the required
              information for verification.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-lg font-bold">
                1. Upload Passport
              </h3>
              <span className="border-border text-muted-foreground rounded-none border bg-card px-2 py-1 text-xs font-medium">
                JPEG, PNG, PDF (Max 5MB)
              </span>
            </div>
            <button
              type="button"
              className="border-muted-foreground/50 hover:bg-muted group flex h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed bg-card p-6 transition-colors"
            >
              <div className="bg-muted group-hover:bg-primary/10 flex size-12 items-center justify-center rounded-full transition-colors">
                <Upload className="text-muted-foreground group-hover:text-primary size-8" />
              </div>
              <div className="text-center">
                <p className="text-foreground mb-1 font-medium">
                  Drag and drop your document here
                </p>
                <p className="text-muted-foreground text-sm">
                  or click to browse from your computer
                </p>
              </div>
            </button>
          </section>

          <section className="border-border flex flex-col gap-6 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-lg font-bold">
                2. Payment Details
              </h3>
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Lock className="size-4" />
                Secure Checkout
              </div>
            </div>
            <div className="border-border flex flex-col gap-5 border bg-card p-6">
              <div className="border-border mb-2 flex items-end justify-between border-b pb-4">
                <div>
                  <p className="text-muted-foreground mb-1 text-sm">Fee Type</p>
                  <p className="text-card-foreground font-bold">
                    Standard Tourist Visa Processing
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-card-foreground text-2xl font-bold">
                    $145.00
                  </p>
                  <p className="text-muted-foreground text-xs">USD</p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="card">Card Information</Label>
                  <div className="border-border flex flex-col border bg-card focus-within:border-foreground sm:flex-row sm:items-stretch">
                    <div className="border-border flex h-12 flex-1 items-center border-b px-3 sm:border-b-0 sm:border-r">
                      <CreditCard className="text-muted-foreground mr-2 size-5" />
                      <Input
                        id="card"
                        className="h-auto rounded-none border-0 p-0 shadow-none focus-visible:ring-0"
                        placeholder="Card number"
                      />
                    </div>
                    <div className="flex h-12">
                      <Input
                        className="border-border h-12 w-24 rounded-none border-0 border-r text-center shadow-none focus-visible:ring-0"
                        placeholder="MM / YY"
                      />
                      <Input
                        className="h-12 w-20 rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                        placeholder="CVC"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name on card</Label>
                  <Input
                    id="name"
                    className="border-border h-12 rounded-none"
                    placeholder="e.g. Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country or region</Label>
                  <select
                    id="country"
                    className="border-input bg-background h-12 w-full rounded-none border px-3 text-sm"
                  >
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Australia</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-start pb-12 pt-6">
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 min-w-[200px] rounded-none px-8 text-base font-semibold"
            >
              Pay &amp; Submit Application
            </Button>
          </div>
        </div>

        <div className="border-border w-full border-t bg-muted/50 lg:w-[40%] lg:border-l lg:border-t-0">
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col overflow-y-auto">
            <div className="bg-card border-border sticky top-0 z-10 flex items-center justify-between border-b p-6">
              <h3 className="text-card-foreground flex items-center gap-2 text-lg font-bold">
                <FileScan className="text-muted-foreground size-5" />
                Extracted Data
              </h3>
              <span className="border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-none border bg-muted px-2.5 py-1 text-xs font-medium">
                <span className="size-1.5 rounded-full bg-yellow-500" />
                Awaiting Upload
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-6 p-6">
              <div className="border-border flex flex-1 flex-col items-center justify-center border border-dashed bg-card/50 p-8 text-center">
                <CloudDownload
                  className="text-muted-foreground mb-4 size-12 opacity-50"
                  aria-hidden
                />
                <p className="text-card-foreground mb-1 text-sm font-medium">
                  No Data Extracted Yet
                </p>
                <p className="text-muted-foreground max-w-[200px] text-xs">
                  Upload a document on the left to see automatically extracted
                  details here.
                </p>
              </div>
            </div>
            <div className="bg-card border-border text-muted-foreground border-t p-4 text-center text-xs">
              Data extraction powered by OCR. Please verify all details before
              submitting.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
