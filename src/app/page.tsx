import Link from "next/link";
import { Navigation } from "@/components/ui/Navigation";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation currentPage="home" showAdminLink={false} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            CPRINT Student Clearance Submission
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Select your academic level to continue with the correct clearance
            submission form.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              Undergraduate
            </h2>
            <p className="text-gray-600 mb-6">
              For undergraduate students submitting their clearance
              requirements.
            </p>
            <Link
              href="/undergraduate"
              className="inline-block w-full text-center bg-primary hover:bg-primary/80 text-white font-medium py-3 px-4 rounded-md transition-colors"
            >
              Go to Undergraduate Form
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              Graduate
            </h2>
            <p className="text-gray-600 mb-6">
              For graduate students submitting dissertation, thesis, capstone,
              or non-thesis clearance requirements.
            </p>
            <Link
              href="/graduate"
              className="inline-block w-full text-center bg-primary hover:bg-primary/80 text-white font-medium py-3 px-4 rounded-md transition-colors"
            >
              Go to Graduate Form
            </Link>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/track"
            className="text-primary hover:text-primary/80 font-medium"
          >
            Already submitted? Track your submission here.
          </Link>
          <p className="mt-3">
            <Link
              href="/coordinators"
              className="text-primary hover:text-primary/80 font-medium"
            >
              Coordinators: Check submission by name or student ID.
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
