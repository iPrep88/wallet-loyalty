import LegalShell, { Section, Bullets, CONTACT_EMAIL, OPERATOR } from '../_shell'
import { PRODUCT_NAME } from '@/lib/product'

export const metadata = {
  title: `Terms — ${PRODUCT_NAME}`,
  description: 'The agreement between your shop and Repio.',
}

/**
 * The terms of service, for shop owners.
 *
 * Deliberately short and in the second person. A corner café owner is going to
 * read this on a phone between orders, and a page they cannot follow is a page
 * that protects nobody — least of all the person who wrote it.
 */
export default function Terms() {
  return (
    <LegalShell
      title="Terms"
      intro="The agreement between your shop and Repio. Short on purpose — you should be able to read the whole thing."
    >
      <Section heading="Who this is with">
        <p>
          This agreement is between your business and {OPERATOR} of Ontario,
          Canada, which operates Repio. Signing up means you accept it, and that
          you have the authority to accept it on your business&rsquo;s behalf.
        </p>
      </Section>

      <Section heading="What we provide">
        <p>
          A digital stamp card for your customers, a code for your counter, a
          way for your staff to add stamps, and a dashboard showing what is
          happening. We host it and keep it running.
        </p>
      </Section>

      <Section heading="What it costs">
        <Bullets items={[
          <><strong>$9.99 CAD per location, per month.</strong></>,
          <><strong>Your first month is free</strong>, and we do not ask for a
            card to start.</>,
          <>Cancel whenever you like, from your dashboard. You keep the service
            until the end of the month you have paid for, and we do not refund
            part-months.</>,
          <>If we ever change the price, you get 30 days&rsquo; notice by email
            and can leave before it applies.</>,
        ]} />
      </Section>

      <Section heading="Your customers&rsquo; information is yours">
        <p>
          This is the important one. The names, phone numbers and stamp history
          belonging to the people who use your card are <strong>yours</strong>,
          not ours. We hold them on your behalf and for no other purpose.
        </p>
        <Bullets items={[
          <>We will not market to your customers, sell their details, or use
            them to approach other shops.</>,
          <>You can export all of it at any time, in a spreadsheet, without
            asking us.</>,
          <>If you leave, it leaves with you, and we delete our copies within
            30 days.</>,
        ]} />
        <p>
          In exchange, collecting it is your responsibility: you must have a
          lawful reason to hold your customers&rsquo; details, you must not tick
          the consent box on someone&rsquo;s behalf, and you must honour a
          request to stop.
        </p>
      </Section>

      <Section heading="Running it honestly">
        <p>Don&rsquo;t use Repio to:</p>
        <Bullets items={[
          <>Add stamps nobody earned, to inflate a figure for someone else.</>,
          <>Promise a reward you do not intend to give. The card is a promise
            your customers can see; honour it or change it before they earn it,
            not after.</>,
          <>Upload a logo or photograph you do not have the right to use.</>,
          <>Break the law, or attack or overload the service.</>,
        ]} />
        <p>
          We can suspend an account doing any of these. If it is a misunderstanding,
          write to us and we will sort it out.
        </p>
      </Section>

      <Section heading="Things we cannot promise">
        <p>
          We aim to keep Repio running all the time, and we will tell you when
          it is not. But Apple Wallet, Google Wallet, your internet connection
          and the phone in your customer&rsquo;s hand are not ours to control,
          and we cannot guarantee uninterrupted service.
        </p>
        <p>
          If something goes wrong and it is our fault, what we owe you is capped
          at what you have paid us in the previous twelve months. We are not
          liable for lost profits or lost business. Nothing here limits anything
          that cannot be limited by law.
        </p>
      </Section>

      <Section heading="Ending it">
        <p>
          You can close your account at any time. We can close yours with 30
          days&rsquo; notice, or immediately if you are doing something in the
          list above. Either way you can take your data with you first, and we
          will tell you before anything is deleted.
        </p>
      </Section>

      <Section heading="Where disputes go">
        <p>
          This agreement is governed by the laws of Ontario and the federal laws
          of Canada that apply there, and the courts of Ontario have
          jurisdiction.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If we change these terms in a way that matters, you get 30 days&rsquo;
          notice by email. Carrying on using Repio after that means you accept
          the new version; if you would rather not, cancel and nothing further
          is owed.
        </p>
        <p>
          Questions:{' '}
          <a className="text-link hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>.
        </p>
      </Section>
    </LegalShell>
  )
}
