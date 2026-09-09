import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex">
      <div className=" p-8 w-full flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center max-w-md">
          {/* 404 Illustration */}
          <div className="relative mb-8">
            <div className="text-9xl font-bold text-gray-200 select-none">404</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl">🔍</div>
            </div>
          </div>

          {/* Message */}
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            Page Not Found
          </h1>
          <p className="text-gray-500 mb-8">
            Oops! The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center gap-2 font-medium"
            >
              <ArrowLeft size={18} />
              Go Back
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2 font-medium shadow-sm hover:shadow-md"
            >
              <Home size={18} />
              Go Home
            </button>
          </div>

          {/* Helpful links */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-400">
              Need help? Contact support or check your URL for typos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;