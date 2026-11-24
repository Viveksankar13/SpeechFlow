"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Mic, History, Sparkles } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export function Header() {
  const pathname = usePathname();
  const [backendReady, setBackendReady] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const verifyBackend = async () => {
      try {
        const res = await apiClient.checkHealth();
        if (active) setBackendReady(res?.status === "ready");
      } catch {
        if (active) setBackendReady(false);
      }
    };

    verifyBackend();
    const timer = setInterval(verifyBackend, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-4 group">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-sm border border-gray-200/80 bg-white group-hover:scale-105 group-hover:shadow-md transition-all flex items-center justify-center p-1 flex-shrink-0">
            <Image
              src="/logo.svg"
              alt="SpeechFlow Logo"
              width={64}
              height={64}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-2xl text-gray-900 tracking-tight">SpeechFlow</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Live AI
              </span>
              {backendReady === true && (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5"
                  title="FastAPI backend connected on port 8000"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Backend Online
                </span>
              )}
              {backendReady === false && (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5"
                  title="FastAPI backend unreachable"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Backend Offline
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 hidden sm:block">Multilingual Real-Time Speech-to-Text</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              pathname === "/"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Record</span>
          </Link>
          <Link
            href="/dashboard"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              pathname === "/dashboard"
                ? "bg-blue-50 text-blue-700 font-semibold"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
