// TV mode screen: open on a TV browser (or a laptop on a TV), join with a
// phone using the code it shows, and the phone's current card appears here.
// See lib/tvLink.js for how the two talk.

import TvScreen from './TvScreen';

export const metadata = {
  title: 'TV · Tralala.cards',
  robots: { index: false, follow: false },
};

export default function TvPage() {
  return <TvScreen />;
}
