/**
 * Prominent credit for DeepState / DeepStateMap — territory data derives from their open mapping work.
 */
export function DeepStateAttribution() {
  return (
    <aside
      className="mb-6 rounded-lg border border-ukraine-blue/25 bg-gradient-to-r from-ukraine-blue/[0.08] to-osint-card border-l-4 border-l-ukraine-blue px-4 py-3.5 sm:px-5"
      aria-label="DeepState data credit"
    >
      <p className="text-sm text-gray-200 leading-relaxed">
        <span className="font-semibold text-white">Data credit — DeepState:</span> Territory and control
        figures on this site are built from open map material associated with{' '}
        <strong className="text-gray-100">DeepState</strong> / DeepStateMap. Their work is an essential public
        resource; we are grateful for the effort that goes into maintaining it.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <a
          href="https://deepstatemap.live/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ukraine-blue hover:text-sky-300 underline-offset-2 hover:underline"
        >
          DeepStateMap — live map
        </a>
        <a
          href="https://deepstateua.shop/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-ukraine-blue hover:text-sky-300 underline-offset-2 hover:underline"
        >
          DeepState shop (deepstateua.shop)
        </a>
      </div>
    </aside>
  );
}
