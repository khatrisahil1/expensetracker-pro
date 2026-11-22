// Lottie animation player, loaded after the page shows. The player (with its
// WebAssembly renderer) is several hundred KB, so it shouldn't delay the first
// paint of the Dashboard. Shows an empty box of the same size until ready.
import React, { lazy, Suspense } from 'react';

const DotLottieReact = lazy(() => import('@lottiefiles/dotlottie-react').then(m => ({ default: m.DotLottieReact })));

type Props = React.ComponentProps<typeof DotLottieReact>;

const LazyLottie: React.FC<Props> = props => (
  <Suspense fallback={<div className={props.className} style={props.style} aria-hidden="true" />}>
    <DotLottieReact {...props} />
  </Suspense>
);

export default LazyLottie;
