"use client";

import { useEffect, useRef } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  items: FAQItem[];
}

export function FAQSection({ items }: FAQSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      obs.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        obs.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <div className="detail-faq-section detail-reveal" ref={sectionRef}>
      <div className="detail-faq-box">
        <div className="detail-faq-title">
          <i className="fa-solid fa-circle-question"></i>
          よくある質問
        </div>

        {items.map((item, index) => (
          <div key={index} className="detail-faq-item">
            <div className="detail-faq-q">
              <span className="q-icon">Q</span>
              {item.question}
            </div>
            <p className="detail-faq-a">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
