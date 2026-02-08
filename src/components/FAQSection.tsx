interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs: FAQItem[];
}

export function FAQSection({ faqs }: FAQSectionProps) {
  return (
    <section className="mt-12 bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        よくある質問
      </h2>
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div key={index}>
            <h3 className="font-medium text-gray-900">
              {faq.question}
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
