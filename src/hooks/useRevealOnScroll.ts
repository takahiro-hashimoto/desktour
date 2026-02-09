"use client";

import { useEffect, useRef } from "react";

/**
 * IntersectionObserver を使って要素が画面に入ったら "visible" クラスを付与するフック
 */
export function useRevealOnScroll<T extends HTMLElement>(threshold = 0.1) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold }
    );

    if (ref.current) {
      obs.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        obs.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return ref;
}
