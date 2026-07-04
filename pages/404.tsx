import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-3">Page not found</h1>
      <p className="text-gray-600 mb-6">The page you requested does not exist.</p>
      <Link href="/" className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">
        Back to Home
      </Link>
    </div>
  );
}
