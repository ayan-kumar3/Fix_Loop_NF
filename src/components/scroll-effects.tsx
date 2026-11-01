"use client";

import * as React from "react";

export function ScrollEffects() {
  React.useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px 80px 0px" }
    );
    let scrollFrame = 0;

    const updateHeroParallax = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        const hero = document.querySelector<HTMLElement>(".landing-hero");
        if (hero) {
          const offset = Math.min(window.scrollY * 0.12, 72);
          hero.style.setProperty("--hero-parallax", `${offset}px`);
        }
        scrollFrame = 0;
      });
    };

    const observeReveals = (root: ParentNode) => {
      if (root instanceof Element && root.matches("[data-reveal]") && !observed.has(root)) {
        observed.add(root);
        observer.observe(root);
      }

      root.querySelectorAll("[data-reveal]").forEach((element) => {
        if (!observed.has(element)) {
          observed.add(element);
          observer.observe(element);
        }
      });
    };

    document.documentElement.classList.add("motion-ready");
    observeReveals(document);
    window.addEventListener("scroll", updateHeroParallax, { passive: true });
    updateHeroParallax();

    const mutations = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) observeReveals(node);
        });
      });
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      window.removeEventListener("scroll", updateHeroParallax);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  return null;
}
