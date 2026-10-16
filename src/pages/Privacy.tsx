import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const UPDATED = 'October 16, 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[17px] font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  )
}

export default function Privacy() {
  return (
    <main className="mx-auto box-content max-w-[560px] px-[clamp(16px,5vw,36px)] pt-[clamp(20px,5vw,32px)] pb-16">
      <Link to="/" className="-ml-2.5 flex h-11 w-fit items-center gap-1.5 rounded-[10px] pr-3 pl-2 text-[15px] font-bold">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </Link>

      <div className="mt-4 flex flex-col gap-6 rounded-panel bg-panel p-6 text-[15px] leading-relaxed text-body shadow-panel">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.01em] text-ink">Privacy</h1>
          <p className="text-[13px] text-muted">Last updated {UPDATED}</p>
        </div>

        <p>
          <span lang="ko">암기</span> keeps only what it needs to save your progress. There are no ads, no analytics and no
          tracking, and nothing is sold or shared.
        </p>

        <Section title="What is stored">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              <b className="text-ink">Your email address</b>, to identify your account.
            </li>
            <li>
              <b className="text-ink">Your password</b>, never as you typed it: only a one-way scrambled form (a hash) that can
              check a password but can't be turned back into it.
            </li>
            <li>
              <b className="text-ink">Your study progress</b>: which words you have reviewed, the answer you gave, when, and
              how long you took, and when each word is due again.
            </li>
            <li>
              <b className="text-ink">Your daily limits</b> for new words, if you change them.
            </li>
          </ul>
          <p>
            As a guest, there is no email or password: only your progress, linked to a cookie in your browser.
          </p>
        </Section>

        <Section title="Cookies and browser storage">
          <p>
            One cookie keeps you signed in. It holds a random code, not your details, and expires after 30 days without use.
            Your display options (dark mode, which translations to show, the selected deck) are saved in your browser and never
            sent anywhere.
          </p>
        </Section>

        <Section title="Where it is kept">
          <p>
            In a database run by the app's hosting provider. It is used only to run the app, and only the app's administrator can
            look at it.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            With an account, open the menu and choose <b className="text-ink">Delete account</b>. Your account, progress and
            review history are deleted immediately and can't be recovered. A guest's progress is deleted automatically about 30
            days after the guest last opened the app.
          </p>
        </Section>
      </div>
    </main>
  )
}
