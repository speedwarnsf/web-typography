'use client';

import { useState } from 'react';

// Replace PLACEHOLDER URLs with actual Stripe Payment Links
const STRIPE_LINKS = {
  coffee_once: "https://buy.stripe.com/eVq9AU8TCecfeEXeMCfbq02",
  craft_once: "https://buy.stripe.com/3cI14o7Py3xB40jcEufbq03",
  patron_once: "https://buy.stripe.com/4gM9AU1ra4BF2WfcEufbq04",
  coffee_monthly: "https://buy.stripe.com/7sY4gA7Py1ptbsL9sifbq05",
  craft_monthly: "https://buy.stripe.com/fZu7sM1ra3xBgN55c2fbq06",
  patron_monthly: "https://buy.stripe.com/aFaaEYc5Ofgj0O747Yfbq07",
  custom: "https://buy.stripe.com/eVq28sc5O3xB1SbgUKfbq08",
};

export default function SupportPage() {
  const [isMonthly, setIsMonthly] = useState(false);

  const tiers = [
    {
      id: 'coffee',
      name: 'Buy a Coffee',
      amount: 5,
      description: 'A small gesture of appreciation',
    },
    {
      id: 'craft',
      name: 'Support the Craft',
      amount: 15,
      description: 'Help fund new tools and refinements',
    },
    {
      id: 'patron',
      name: 'Patron of Type',
      amount: 50,
      description: 'Sustain the practice and research',
    },
  ];

  return (
    <main className="min-h-screen overflow-x-clip">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Hung gold dashes that share the line box — baseline-aligned by
           construction, never nudged by eye. */
        .support-funds { list-style: none; padding-left: 1.6em; }
        .support-funds li { position: relative; margin-bottom: 0.9em; }
        .support-funds li:last-child { margin-bottom: 0; }
        .support-funds li::before {
          content: "—";
          position: absolute;
          left: -1.6em;
          color: #B8963E;
        }
        /* Superior currency: the $ rides at cap height, ~55% of the figure
           size — how books have set prices for a century. */
        .support-cur {
          font-size: 0.55em;
          line-height: 0;
          vertical-align: baseline;
          position: relative;
          top: -0.52em;
          margin-right: 0.05em;
        }
      `,
        }}
      />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-32 pb-24">
        {/* Header */}
        <div className="mb-16">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
            Support
          </div>
          <h1 className="text-4xl sm:text-5xl mb-8">
            Help Us Build Better Tools
          </h1>
          <p className="font-source-sans text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl" style={{ textWrap: "pretty" }}>
            Typeset.us is free, open, and built by one designer with 30 years
            of practice. Your support helps expand the toolset and keep it all&nbsp;accessible.
          </p>
        </div>

        {/* What Your Support Funds */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl mb-8">
            What Your Support Funds
          </h2>
          <ul className="support-funds font-source-sans text-neutral-300 leading-relaxed">
            <li>New typographic tools and refinements</li>
            <li>Research into web typography standards</li>
            <li>Keeping all tools free and accessible</li>
            <li>Server costs and infrastructure</li>
            <li>Font licensing for expanded specimen libraries</li>
          </ul>
        </div>

        {/* One-time vs Monthly Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex border border-neutral-800 bg-neutral-950/50">
            <button
              onClick={() => setIsMonthly(false)}
              className={`px-6 py-3 font-source-sans transition-colors ${
                !isMonthly
                  ? 'bg-[#B8963E] text-[#0a0a0a]'
                  : 'text-neutral-200 hover:text-white'
              }`}
            >
              One-time
            </button>
            <button
              onClick={() => setIsMonthly(true)}
              className={`px-6 py-3 font-source-sans transition-colors ${
                isMonthly
                  ? 'bg-[#B8963E] text-[#0a0a0a]'
                  : 'text-neutral-200 hover:text-white'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Support Options Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 lg:p-8 flex flex-col"
            >
              <h3 className="text-2xl mb-3">
                {tier.name}
              </h3>
              <div className="mb-4">
                <span className="text-4xl font-playfair text-[#B8963E]">
                  <sup className="support-cur">$</sup>
                  {tier.amount}
                </span>
                {isMonthly && (
                  <span className="text-neutral-400 font-source-sans ml-1">
                    /mo
                  </span>
                )}
              </div>
              <p className="font-source-sans text-neutral-400 mb-8 flex-grow">
                {tier.description}
              </p>
              <a
                href={
                  isMonthly
                    ? STRIPE_LINKS[`${tier.id}_monthly` as keyof typeof STRIPE_LINKS]
                    : STRIPE_LINKS[`${tier.id}_once` as keyof typeof STRIPE_LINKS]
                }
                data-tier={tier.id}
                className="block text-center border border-[#B8963E] text-[#B8963E] px-6 py-3 font-source-sans hover:bg-[#B8963E] hover:text-[#0a0a0a] transition-colors"
              >
                Support
              </a>
            </div>
          ))}
        </div>

        {/* Custom Amount */}
        <div className="text-center mb-16">
          <p className="font-source-sans text-neutral-400 mb-3">
            Want to give a different amount?
          </p>
          <a
            href={STRIPE_LINKS.custom}
            className="text-[#B8963E] hover:underline font-source-sans"
          >
            Choose your own contribution
          </a>
        </div>

        {/* Transparency Note */}
        <div className="border-t border-neutral-800 pt-8 mb-16">
          <p className="font-source-sans text-sm text-neutral-500 leading-relaxed max-w-2xl mx-auto text-center">
            Typeset.us is built and maintained by Dustin York. 100% of contributions go directly to developing new tools and keeping existing ones free. No venture capital. No ads. Just craft.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center space-x-8 font-source-sans text-neutral-400">
          <a href="/" className="hover:text-[#B8963E] transition-colors">
            Back to Tools
          </a>
          <a href="/about" className="hover:text-[#B8963E] transition-colors">
            About
          </a>
        </div>
      </div>
    </main>
  );
}
