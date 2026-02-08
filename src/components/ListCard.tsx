import Link from "next/link";

interface ListCardProps {
  href: string;
  icon: string;
  title: string;
  count: number;
  tags?: string[];
  description?: string;
}

export function ListCard({
  href,
  icon,
  title,
  count,
  tags = [],
  description,
}: ListCardProps) {
  return (
    <Link
      href={href}
      className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              {title}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {count}件
            </span>
          </div>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {description && (
        <p className="text-xs text-gray-600 mt-3 line-clamp-2">
          {description}
        </p>
      )}
      <div className="mt-3 flex items-center text-sm text-blue-600 group-hover:text-blue-700">
        詳細を見る
        <svg
          className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
