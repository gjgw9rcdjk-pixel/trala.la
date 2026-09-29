'use client';

import { CATEGORIES, QUESTIONS, QUESTION_BY_ID } from '@/lib/content';
import { LANDING } from '@/lib/landingCopy';
import { useLandingLang } from '@/lib/useLandingLang';
import { PATH_BY_LANG } from '@/lib/seo';
import { DECK_STYLE, SPICE_OF } from '@/lib/gameMeta';

// Hand-picked sample questions per deck: short, funny and easy to share, so
// the landing page shows the best of each deck. Decks not listed here (and any
// id that no longer exists) fall back to the highest stored like rate, then id.
// The 18+ deck only shows its mild cards here.
const SAMPLE_PICKS = {
  union: ['union-02', 'union-09', 'union-19'],
  know: ['know-02', 'know-05', 'know-10'],
  night: ['night-01', 'night-03', 'night-10'],
  reply: ['reply-12', 'reply-13', 'reply-20'],
  dnd: ['dnd-01', 'dnd-02', 'dnd-16'],
  firsts: ['firsts-04', 'firsts-07', 'firsts-20'],
  awkward: ['awkward-01', 'awkward-08', 'awkward-14'],
  duo: ['duo-01', 'duo-04', 'duo-13'],
  door: ['door-01', 'door-08', 'door-12'],
  fries: ['fries-01', 'fries-14', 'fries-19'],
};

const SAMPLES = Object.fromEntries(
  CATEGORIES.map((c) => {
    const picked = (SAMPLE_PICKS[c.id] ?? []).map((id) => QUESTION_BY_ID.get(id)).filter(Boolean);
    const fallback = QUESTIONS
      .filter((q) => q[0] === c.id && (c.id !== 'spicy' || SPICE_OF[q[1]] === 'mild'))
      .sort((a, b) => (b[3] ?? 0) - (a[3] ?? 0) || a[1].localeCompare(b[1]));
    return [c.id, picked.length === 3 ? picked : fallback.slice(0, 3)];
  })
);

export default function LandingContent({ lang: initialLang = 'en' }) {
  const lang = useLandingLang(initialLang);
  const t = LANDING[lang] ?? LANDING.en;
  // Vibe links stay on this route's own path (e.g. /lt/?vibe=deep#play) —
  // tied to the page's own language, not whatever the switcher currently
  // shows, so a crawler (which never clicks the switcher) always lands back
  // on the same indexed URL it came from.
  const vibeBasePath = PATH_BY_LANG[initialLang] === '/' ? '' : PATH_BY_LANG[initialLang];

  return (
    <>
      <section className="land-intro">
        <div className="land-wrap land-intro-inner">
          <div className="land-kicker">Tralala</div>
          <h2 className="land-intro-h2">
            {t.h2Line1} {t.h2Line2}
          </h2>
          <p className="land-lede">{t.lede}</p>
          <a className="land-cta" href="#play">{t.cta}</a>
          <div className="land-fineprint">{t.introFine}</div>
        </div>
      </section>

      <section className="land-section" aria-labelledby="vibes-h2">
        <div className="land-wrap">
          <h2 id="vibes-h2" className="land-h2">{t.vibesH2}</h2>
          <div className="land-vibe-grid">
            {CATEGORIES.map((c) => (
              <a
                key={c.id}
                className={`land-vibe-card${DECK_STYLE[c.id].color ? '' : ' land-vibe-card--raised'}`}
                style={DECK_STYLE[c.id].color ? { '--vibe': DECK_STYLE[c.id].color } : undefined}
                href={`${vibeBasePath}/?vibe=${c.id}#play`}
              >
                <span className="land-vibe-icon" aria-hidden="true">{DECK_STYLE[c.id].glyph}</span>
                <span className="land-vibe-name">{t.vibes[c.id]?.title}</span>
                <span className="land-vibe-blurb">{t.vibes[c.id]?.blurb}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section" aria-labelledby="about-h2">
        <div className="land-wrap land-narrow">
          <h2 id="about-h2" className="land-h2">{t.aboutH2}</h2>
          <p className="land-p">{t.aboutP1}</p>
          <p className="land-p">{t.aboutP2}</p>
          <p className="land-p">{t.aboutP3}</p>
        </div>
      </section>

      <section className="land-section" aria-labelledby="samples-h2">
        <div className="land-wrap">
          <h2 id="samples-h2" className="land-h2">{t.samplesH2}</h2>
          <div className="land-sample-grid">
            {CATEGORIES.map((c) => (
              <article key={c.id} className="land-sample">
                <h3 className="land-sample-title">{t.vibes[c.id]?.title}</h3>
                <ul className="land-sample-list">
                  {SAMPLES[c.id].map((q) => <li key={q[1]} lang={lang}>{q[2][lang]}</li>)}
                </ul>
                <a className="land-sample-play" href={`${vibeBasePath}/?vibe=${c.id}#play`}>{t.samplesPlay} →</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section" aria-labelledby="faq-h2">
        <div className="land-wrap land-narrow">
          <h2 id="faq-h2" className="land-h2">{t.faqH2}</h2>
          <div className="land-faq">
            {t.faq.map(([q, a]) => (
              <div key={q} className="land-faq-item">
                <h3 className="land-faq-q">{q}</h3>
                <p className="land-p">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section land-cta-section">
        <div className="land-wrap">
          <h2 className="land-h2">{t.ctaH2}</h2>
          <a className="land-cta" href="#play">{t.cta}</a>
          <div className="land-fineprint">{t.ctaFine}</div>
        </div>
      </section>
    </>
  );
}
