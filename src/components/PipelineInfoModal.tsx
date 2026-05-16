import { PIPELINE_DOC_SECTIONS, PIPELINE_DOC_TITLE } from '@/data/pipelineDocumentation';

type Props = {
  onClose: () => void;
};

export function PipelineInfoModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pipeline-doc-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[min(85vh,720px)] flex flex-col bg-osint-card border border-osint-border rounded-lg shadow-xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-osint-border shrink-0">
          <div>
            <h2 id="pipeline-doc-title" className="text-lg font-semibold text-white">
              {PIPELINE_DOC_TITLE}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Methodology and data flow — for understanding and review
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ukraine-blue/50"
            onClick={onClose}
            aria-label="Close documentation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-6 text-sm text-gray-300 leading-relaxed">
          {PIPELINE_DOC_SECTIONS.map((section) => (
            <section key={section.id} aria-labelledby={`doc-${section.id}`}>
              <h3 id={`doc-${section.id}`} className="text-base font-semibold text-white mb-2">
                {section.title}
              </h3>
              {section.paragraphs.map((p, i) => (
                <p key={i} className="mb-2 last:mb-0">
                  {p}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-2 list-disc pl-5 space-y-1 text-gray-400">
                  {section.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-osint-border shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded bg-ukraine-blue text-white font-medium hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
