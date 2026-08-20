"use client";

import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import {
  TerminalIcon,
  SparklesIcon,
  Code2Icon,
  ArrowRightIcon,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const LandingView = () => {
  return (
    <div className="min-h-screen bg-sidebar flex flex-col justify-between p-6 md:p-12">
      {/* Top Header */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/prism.png"
            alt="Prism Logo"
            width={40}
            height={40}
            className="size-8 md:size-10 aspect-square object-contain rounded-lg shrink-0"
            priority
          />
          <span
            className={cn(
              "text-2xl md:text-3xl font-semibold tracking-tight",
              font.className,
            )}
          >
            Prism
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm">Get Started</Button>
          </SignUpButton>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-3xl mx-auto flex flex-col items-center text-center my-auto py-12 gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-accent/60 text-accent-foreground border border-border">
          <span className="size-1.5 rounded-full bg-sky-400 animate-pulse" />
          Browser-Native Cloud IDE
        </div>

        <h1
          className={cn(
            "text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground max-w-2xl",
            font.className,
          )}
        >
          Build, run, and preview full-stack apps in your browser.
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg max-w-xl leading-relaxed">
          Write code with real-time AI assistance, run Node.js applications with
          zero local setup, and preview your work instantly.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <SignUpButton mode="modal">
            <Button size="lg" className="gap-2 h-11 px-6">
              Start Building
              <ArrowRightIcon className="size-4" />
            </Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button variant="outline" size="lg" className="h-11 px-6">
              Sign In to Dashboard
            </Button>
          </SignInButton>
        </div>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-8 text-left">
          <div className="p-4 rounded-lg bg-background border border-border flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-medium text-sm">
              <TerminalIcon className="size-4 text-sky-400" />
              In-Browser Node.js Runtime
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              Powered by WebContainers and WebAssembly. Run dev servers and live
              terminals directly in the browser with no local setup.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-background border border-border flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-medium text-sm">
              <SparklesIcon className="size-4 text-amber-400" />
              AI-First Coding Assistance
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              Inline cursor completions, Cmd+K quick-edit with live doc
              scraping, and an autonomous multi-file coding agent.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-background border border-border flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-medium text-sm">
              <Code2Icon className="size-4 text-emerald-400" />
              Multi-Tab Code Editor
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              CodeMirror 6 multi-tab editor with tab pinning, breadcrumb
              navigation, and full syntax support for TypeScript, JS, HTML, and
              CSS.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-background border border-border flex flex-col gap-2">
            <div className="flex items-center gap-2 text-foreground font-medium text-sm">
              <FaGithub className="size-4 text-purple-400" />
              GitHub Bi-Directional Sync
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              Import public and private repositories by URL, and export your
              projects directly back to GitHub with background jobs.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground pt-6 border-t border-border/50">
        <span>Prism — Full-Stack Cloud IDE</span>
        <div className="flex items-center gap-4">
          <Link
            href="https://github.com/aditya-gupta-me/Prism"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </Link>
        </div>
      </footer>
    </div>
  );
};
