/**
 * Header - Application header with branding
 */
type HeaderProps = {
  onInfoClick?: () => void;
  onFeedbackClick?: () => void;
};

export function Header({ onInfoClick, onFeedbackClick }: HeaderProps) {
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
            {onFeedbackClick && (
              <button
                type="button"
                onClick={onFeedbackClick}
                className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium rounded-md border border-osint-border text-gray-300 hover:text-white hover:border-gray-500 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-ukraine-blue/50"
              >
                Provide feedback
              </button>
            )}
            {onFeedbackClick && (
              <button
                type="button"
                onClick={onFeedbackClick}
                className="sm:hidden px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-osint-border text-gray-300 hover:text-white"
                aria-label="Provide feedback"
              >
                Feedback
              </button>
            )}
            {onInfoClick && (
              <button
                type="button"
                onClick={onInfoClick}
                className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border-2 border-ukraine-blue/60 bg-ukraine-blue/15 text-ukraine-blue shadow-[0_0_12px_rgba(59,130,246,0.25)] hover:bg-ukraine-blue/25 hover:text-white hover:border-ukraine-blue focus:outline-none focus:ring-2 focus:ring-ukraine-blue/60 focus:ring-offset-2 focus:ring-offset-osint-card"
                aria-label="How this data works"
                title="How this data works"
              >
                <svg className="h-7 w-7 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <text
                    x="12"
                    y="16.5"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="14"
                    fontWeight="700"
                    fontFamily="Georgia, 'Times New Roman', serif"
                  >
                    i
                  </text>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
