import LegalShell, { Section, Bullets, CONTACT_EMAIL, OPERATOR } from '../_shell'
import { PRODUCT_NAME } from '@/lib/product'

export const metadata = {
  title: `Privacy — ${PRODUCT_NAME}`,
  description: 'What we collect, why, and what you can ask us to do about it.',
}

/**
 * The privacy policy.
 *
 * Written around the one thing that makes this product unusual: there are TWO
 * kinds of people in it, and they have different relationships with us. The
 * shop owner is our customer. Their customer is not — they are the shop's,
 * and we only hold their details on the shop's behalf. Conflating the two is
 * how loyalty companies end up quietly building a marketing list out of other
 * people's customers, and saying plainly that we do not is worth more than
 * any amount of legal throat-clearing.
 */
export default function Privacy() {
  return (
    <LegalShell
      title="Privacy"
      intro="Two kinds of people use Repio, and they are not in the same position. This page says what we hold for each, why, and what you can ask us to do about it."
    >
      <Section heading="Who we are">
        <p>
          Repio is a digital stamp-card service operated by {OPERATOR} in Ontario,
          Canada. We are the business responsible for the information described
          below, and you can reach us at{' '}
          <a className="text-link hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>.
        </p>
      </Section>

      <Section heading="If you run a shop">
        <p>You are our customer. We hold:</p>
        <Bullets items={[
          <>Your name, email address and a one-way scrambled version of your
            password. We cannot read your password, and neither can anyone who
            steals the file it lives in.</>,
          <>Your shop&rsquo;s name, locations, addresses, opening hours and the
            design of your card.</>,
          <>Your staff&rsquo;s names and the four-digit codes they use at the
            counter, also one-way scrambled.</>,
          <>A record of every stamp, reward and correction made at your
            counter, including which staff member made it.</>,
        ]} />
        <p>
          We use it to run the service and to show you your own numbers. We do
          not sell it, and we do not use it to advertise to you on behalf of
          anyone else.
        </p>
      </Section>

      <Section heading="If you collect stamps at a shop">
        <p>
          You are the shop&rsquo;s customer, not ours. The shop decides what to
          collect and why; we hold it for them. On your card we keep:
        </p>
        <Bullets items={[
          <>Your stamp count, your rewards and when you visited.</>,
          <>Your first name and phone number — <strong>both optional</strong>.
            Your card works without either. The phone number exists so you can
            get your stamps back on a new phone.</>,
          <>Whether you agreed to be texted, and the moment you agreed.</>,
        ]} />
        <p>
          We never ask for your address, your date of birth, or anything about
          what you bought beyond the fact that you came in. We do not track you
          between shops: your card at one shop is a separate thing from your
          card at another, even when both use Repio.
        </p>
        <p>
          To be removed, ask the shop, or write to us at{' '}
          <a className="text-link hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{' '}and we will pass it on and act on it.
        </p>
      </Section>

      <Section heading="Text messages">
        <p>
          A shop can only text you if you ticked the box, and the tick is
          recorded with the date and time it happened. That is Canada&rsquo;s
          anti-spam law (CASL) and we built the product to make it difficult to
          get wrong — consent cannot be added to an existing card after the
          fact, and every message carries a way to stop them.
        </p>
      </Section>

      <Section heading="Who else sees any of this">
        <Bullets items={[
          <><strong>Apple and Google</strong>, if a customer adds their card to
            a phone wallet. They receive the card itself — the shop&rsquo;s name,
            the stamp count, the artwork — and are bound by their own terms.</>,
          <><strong>Nobody else.</strong> There is no advertising network here,
            no analytics company watching your customers, and no data broker.
            The service runs on servers {OPERATOR} rents and controls directly,
            in Canada.</>,
        ]} />
      </Section>

      <Section heading="How long we keep it">
        <p>
          A card and its history stay for as long as the shop uses Repio. When a
          shop closes its account we delete its cards, its customers&rsquo;
          details and its stamp history within 30 days. Backups are encrypted
          and roll off within 90 days.
        </p>
      </Section>

      <Section heading="What you can ask for">
        <p>
          Under Canadian privacy law (PIPEDA) you can ask us for a copy of what
          we hold about you, ask us to correct it, ask us to delete it, and
          withdraw a consent you gave earlier. Write to{' '}
          <a className="text-link hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>. We answer within 30 days. A shop owner can export their own
          data at any time from their dashboard without asking anyone.
        </p>
        <p>
          If you are unhappy with how we answer, you can complain to the Office
          of the Privacy Commissioner of Canada.
        </p>
      </Section>

      <Section heading="If something goes wrong">
        <p>
          If information is lost or taken in a way that creates a real risk of
          significant harm, we will tell the affected shops and the Privacy
          Commissioner, as the law requires, and we will say what happened
          rather than what sounds best.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If this page changes in a way that matters, we will email shop owners
          before it takes effect. The date at the top always reflects the
          current version.
        </p>
      </Section>
    </LegalShell>
  )
}
