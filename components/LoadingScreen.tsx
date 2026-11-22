// Loader shown while sign-in state loads. It reuses the boot splash markup from
// <template id="boot-template"> in index.html (the piggy bank), so going from
// the static splash to this screen to the app looks like one animation.
// It used to stream an animation from lottie.host (blank when offline) and
// rotate messages about features the app doesn't have.
import React from 'react';

/** The splash markup from index.html; a simple fallback where it isn't present (tests). */
const bootMarkup = () =>
  (typeof document !== 'undefined' && document.getElementById('boot-template')?.innerHTML) ||
  '<p class="boot-name">Expense<b>Tracker</b></p><div class="boot-bar"></div>';

export const LoadingScreen: React.FC = () => {
  const light = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
  return (
    <div className={`boot ${light ? 'light' : ''}`} role="status" aria-label="Loading"
      dangerouslySetInnerHTML={{ __html: bootMarkup() }} />
  );
};

/** Small in-page loader while a page's code downloads (no full-screen flash). */
export const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center py-32" role="status" aria-label="Loading page">
    <span className="boot-dots"><i /><i /><i /></span>
  </div>
);

export default LoadingScreen;

/**
 * The piggy-bank mascot from the boot splash, for use elsewhere (login,
 * onboarding). Reads the same <template> so there is one drawing to maintain.
 */
export const PiggyMascot: React.FC<{ className?: string }> = ({ className = '' }) => {
  const html = typeof document !== 'undefined'
    ? (document.getElementById('boot-template') as HTMLTemplateElement | null)?.content.querySelector('.boot-pig-wrap')?.outerHTML
    : undefined;
  if (!html) return null;
  return <div className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
};
