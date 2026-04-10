import { ArrowRight, Image as ImageIcon, Lock, Sparkles } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-medium tracking-tight text-black mb-8">
            Your visual memory.
          </h1>
          <p className="text-xl text-gray-500 mb-12 font-light">
            AI-powered image intelligence that runs entirely on your device.
            Fast, private, and beautiful.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-transform hover:scale-105 active:scale-95"
          >
            Start Uploading
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-32">
        <div className="flex flex-col md:flex-row gap-12 justify-center border-t border-gray-100 pt-16">
          <div className="flex items-center gap-4">
            <Lock className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-black">Private</h3>
              <p className="text-sm text-gray-500">100% local processing</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Sparkles className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-black">Intelligent</h3>
              <p className="text-sm text-gray-500">Natural language search</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ImageIcon className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-black">Organized</h3>
              <p className="text-sm text-gray-500">Automatic clustering</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
