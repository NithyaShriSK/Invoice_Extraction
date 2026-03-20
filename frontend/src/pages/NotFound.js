import React from 'react';
import { Link } from 'react-router-dom';
import { Home, FileText, Search } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-24 w-24 text-blue-600">
            <Search className="h-full w-full" />
          </div>
          <h1 className="mt-6 text-4xl font-bold text-gray-900">404</h1>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">Page not found</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sorry, we couldn't find the page you're looking for.
          </p>
          <div className="mt-6">
            <Link
              to="/dashboard"
              className="btn btn-primary"
            >
              <Home className="h-4 w-4 mr-2" />
              Go back home
            </Link>
          </div>
          <div className="mt-4">
            <Link
              to="/history"
              className="btn btn-outline"
            >
              <FileText className="h-4 w-4 mr-2" />
              View invoices
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
