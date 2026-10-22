/**
 * The owner-facing kit.
 *
 * Everything here reads from the semantic tokens in globals.css, so the brand
 * lives in one file and both themes move together. Nothing in here belongs on
 * a customer-facing page — the join page and the card wear the shop's colours,
 * and the whole promise is that their card is theirs, not ours.
 */
import type { ReactNode } from 'react'

export function Card(
  { children, className = '', flush = false }:
  { children: ReactNode; className?: string; flush?: boolean },
) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface ${flush ? '' : 'p-5'} ${className}`}
      style={{ boxShadow: 'var(--raised)' }}
    >
      {children}
    </div>
  )
}

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'quiet'
  full?: boolean
  className?: string
}

export function Button({
  children, onClick, type = 'button', disabled,
  variant = 'primary', full = false, className = '',
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 text-[15px] ' +
    'font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45'
  const height = 'h-[52px]'
  const look = {
    primary: 'bg-accent text-accent-ink hover:brightness-110',
    secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
    quiet: 'text-muted hover:text-ink',
  }[variant]

  return (
    <button type={type} onClick={onClick} disabled={disabled}
            className={`${base} ${height} ${look} ${full ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-surface-2 px-4 py-3.5 text-[15px] ' +
  'text-ink placeholder:text-faint transition-colors ' +
  'hover:border-faint focus:border-accent focus:outline-none'

export function Field(
  { label, hint, children }: { label: string; hint?: string; children: ReactNode },
) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold tracking-[-0.005em]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12.5px] leading-snug text-muted">{hint}</span>}
    </label>
  )
}

/** A small uppercase label. Used above tiles and section headings. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-faint">
      {children}
    </span>
  )
}

export function PageTitle(
  { children, sub }: { children: ReactNode; sub?: ReactNode },
) {
  return (
    <div>
      <h1 className="text-[26px] font-extrabold leading-[1.12] tracking-[-0.025em]">
        {children}
      </h1>
      {sub && <p className="mt-1.5 text-[14.5px] leading-snug text-muted">{sub}</p>}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[15px] font-bold tracking-[-0.01em]">{children}</h2>
  )
}

export function Notice(
  { tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode },
) {
  const look = {
    info: 'border-line bg-accent-soft text-ink',
    warn: 'border-amber-300/60 bg-amber-50 text-amber-900 ' +
          'dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200',
    error: 'border-red-300/60 bg-red-50 text-red-800 ' +
           'dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200',
  }[tone]
  return (
    <div className={`rounded-xl border px-4 py-3 text-[13.5px] leading-snug ${look}`}>
      {children}
    </div>
  )
}

/** The mark, drawn rather than loaded — one small file fewer to serve. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="1.5" y="4.5" width="21" height="15" rx="3.5"
              stroke="var(--accent)" strokeWidth="1.8" />
        <path d="M1.5 9.5h21" stroke="var(--accent)" strokeWidth="1.8" />
        <circle cx="7" cy="14.5" r="1.6" fill="var(--accent)" />
        <circle cx="12" cy="14.5" r="1.6" fill="var(--accent)" />
        <circle cx="17" cy="14.5" r="1.6" fill="var(--accent)" opacity="0.3" />
      </svg>
      <span className="text-[14px] font-extrabold tracking-[-0.02em]">Wallet Loyalty</span>
    </span>
  )
}
