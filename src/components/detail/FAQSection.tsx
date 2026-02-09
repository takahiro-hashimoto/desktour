"use client";

import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  items: FAQItem[];
}

export function FAQSection({ items }: FAQSectionProps) {
  const sectionRef = useRevealOnScroll<HTMLDivElement>();

  return (
    <section className="detail-faq-section detail-reveal" ref={sectionRef}>
      <div className="detail-faq-box">
        <h2 className="detail-faq-title">
          <i className="fa-solid fa-circle-question"></i>
          よくある質問
        </h2>

        <dl>
          {items.map((item, index) => (
            <div key={index} className="detail-faq-item">
              <dt className="detail-faq-q">
                <span className="q-icon">Q</span>
                {item.question}
              </dt>
              <dd className="detail-faq-a">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
