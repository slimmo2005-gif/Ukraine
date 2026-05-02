/**
 * Header - Application header with branding
 */
export function Header() {
  return (
    <header className="bg-osint-card border-b border-osint-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <div className="flex">
              <div className="w-3 h-6 bg-ukraine-blue rounded-l"></div>
              <div className="w-3 h-6 bg-ukraine-yellow rounded-r"></div>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Ukraine War
              <span className="text-gray-400 font-normal"> Territory Tracker</span>
            </h1>
          </div>

          {/* Metadata */}
          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-400">
            <span>OSINT Dashboard</span>
            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
            <span>Last updated: {new Date().toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}</span>
          </div>

          {/* Mobile menu placeholder */}
          <button className="sm:hidden text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
