/**
 * Header - Application header with branding
 */
type HeaderProps = {
  onInfoClick?: () => void;
};

export function Header({ onInfoClick }: HeaderProps) {
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
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
              <span>
                Ukraine War
                <span className="text-gray-400 font-normal"> Territory Tracker</span>
              </span>
              <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
                Beta
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm text-gray-400">
              <span>OSINT Dashboard</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full" aria-hidden />
              <span>
                Last updated:{' '}
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            {onInfoClick && (
              <button
                type="button"
                onClick={onInfoClick}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-osint-border bg-osint-dark text-gray-300 hover:text-white hover:border-ukraine-blue/50 focus:outline-none focus:ring-2 focus:ring-ukraine-blue/40"
                aria-label="How this data works"
                title="How this data works"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                  <path stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" d="M12 11v5M12 8h.01" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
