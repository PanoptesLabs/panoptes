"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Network", href: "#network" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "API", href: "#api" },
  { label: "Contact", href: "#contact" },
] as const;

const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL
  ? `${process.env.NEXT_PUBLIC_DASHBOARD_URL}/dashboard`
  : "/dashboard";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll-spy with IntersectionObserver
  useEffect(() => {
    const sectionIds = NAV_LINKS.map((l) => l.href.slice(1));
    const observers: IntersectionObserver[] = [];

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (!el) continue;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    }

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = useCallback((href: string) => {
    setMobileOpen(false);
    const el = document.getElementById(href.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-soft-violet/10 bg-midnight-plum/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <a href="#main-content" className="flex items-center gap-2">
          <Image src="/logo.svg" alt={APP_NAME} width={28} height={28} className="size-7" />
          <span className="font-display text-lg font-semibold text-dusty-lavender">{APP_NAME}</span>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className={`text-sm transition-colors ${
                activeSection === link.href.slice(1)
                  ? "text-soft-violet"
                  : "text-dusty-lavender/70 hover:text-dusty-lavender"
              }`}
            >
              {link.label}
            </button>
          ))}
          <a
            href={dashboardUrl}
            className="rounded-lg bg-soft-violet px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-deep-iris"
          >
            Dashboard
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-dusty-lavender md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-soft-violet/10 bg-midnight-plum/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeSection === link.href.slice(1)
                      ? "bg-soft-violet/10 text-soft-violet"
                      : "text-dusty-lavender/70 hover:bg-soft-violet/5 hover:text-dusty-lavender"
                  }`}
                >
                  {link.label}
                </button>
              ))}
              <a
                href={dashboardUrl}
                className="mt-2 rounded-lg bg-soft-violet px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-deep-iris"
              >
                Dashboard
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
