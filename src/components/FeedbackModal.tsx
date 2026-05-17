import { useMemo, useState } from 'react';
import { countWords } from '@/utils/week-ending-saturday';
import { getAnalyticsBaseUrl, submitFeedback } from '@/lib/analytics';

const MAX_WORDS = 200;

type Props = {
  onClose: () => void;
};

export function FeedbackModal({ onClose }: Props) {
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactDiscord, setContactDiscord] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const wordCount = useMemo(() => countWords(message), [message]);
  const overLimit = wordCount > MAX_WORDS;
  const configured = Boolean(getAnalyticsBaseUrl());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }
    if (overLimit) {
      setError(`Please keep your message to ${MAX_WORDS} words or fewer.`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitFeedback({
        message: message.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactWhatsapp: contactWhatsapp.trim() || undefined,
        contactDiscord: contactDiscord.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[min(85vh,640px)] flex flex-col bg-osint-card border border-osint-border rounded-lg shadow-xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-osint-border shrink-0">
          <div>
            <h2 id="feedback-title" className="text-lg font-semibold text-white">
              Provide feedback
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Suggestions, corrections, or questions — optional contact details if you want a reply.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ukraine-blue/50"
            onClick={onClose}
            aria-label="Close feedback"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {sent ? (
          <div className="px-5 py-8 text-center">
            <p className="text-white font-medium mb-2">Thank you</p>
            <p className="text-sm text-gray-400">Your feedback has been submitted.</p>
          </div>
        ) : (
          <form id="feedback-form" onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4 flex-1 min-h-0">
            {!configured && (
              <p className="text-sm text-amber-400/90 p-3 rounded border border-amber-500/30 bg-amber-500/10">
                Feedback is not available on this build (analytics API URL missing).
              </p>
            )}
            <div>
              <label htmlFor="feedback-message" className="block text-xs text-gray-400 mb-1">
                Message <span className="text-gray-600">(max {MAX_WORDS} words)</span>
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded bg-osint-dark border border-osint-border text-white text-sm focus:outline-none focus:ring-1 focus:ring-ukraine-blue resize-y min-h-[120px]"
                placeholder="What would you like to share?"
                disabled={!configured}
              />
              <p className={`text-[11px] mt-1 tabular-nums ${overLimit ? 'text-red-400' : 'text-gray-500'}`}>
                {wordCount} / {MAX_WORDS} words
              </p>
            </div>
            <p className="text-[11px] text-gray-500">Optional — only if you want a response:</p>
            <div>
              <label htmlFor="feedback-email" className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                id="feedback-email"
                type="email"
                autoComplete="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 rounded bg-osint-dark border border-osint-border text-white text-sm focus:outline-none focus:ring-1 focus:ring-ukraine-blue"
                placeholder="you@example.com"
                disabled={!configured}
              />
            </div>
            <div>
              <label htmlFor="feedback-whatsapp" className="block text-xs text-gray-400 mb-1">WhatsApp</label>
              <input
                id="feedback-whatsapp"
                type="text"
                value={contactWhatsapp}
                onChange={(e) => setContactWhatsapp(e.target.value)}
                className="w-full px-3 py-2 rounded bg-osint-dark border border-osint-border text-white text-sm focus:outline-none focus:ring-1 focus:ring-ukraine-blue"
                placeholder="Phone or handle"
                disabled={!configured}
              />
            </div>
            <div>
              <label htmlFor="feedback-discord" className="block text-xs text-gray-400 mb-1">Discord</label>
              <input
                id="feedback-discord"
                type="text"
                value={contactDiscord}
                onChange={(e) => setContactDiscord(e.target.value)}
                className="w-full px-3 py-2 rounded bg-osint-dark border border-osint-border text-white text-sm focus:outline-none focus:ring-1 focus:ring-ukraine-blue"
                placeholder="Username"
                disabled={!configured}
              />
            </div>
          </form>
        )}
        <div className="px-5 py-3 border-t border-osint-border shrink-0 flex justify-end gap-2">
          {sent ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-ukraine-blue text-white font-medium hover:opacity-90"
            >
              Close
            </button>
          ) : (
            <>
              {error && <p className="text-sm text-red-400 mr-auto self-center">{error}</p>}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded border border-osint-border text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="feedback-form"
                disabled={submitting || !configured || !message.trim() || overLimit}
                className="px-4 py-2 text-sm rounded bg-ukraine-blue text-white font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send feedback'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
