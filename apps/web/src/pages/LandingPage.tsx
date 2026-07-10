import { Container } from '@/components/ui/Container';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PayPalIcon } from '@/components/PayPalIcon';
import { GenerateForm } from '@/features/generate/GenerateForm';

const PAYPAL_URL = 'https://www.paypal.com/paypalme/28baraa';

const FEATURES = [
  {
    title: 'Clean typography',
    description: 'Magazine-quality layout with elegant fonts and generous spacing.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    ),
  },
  {
    title: 'Content only',
    description: 'No usernames, likes, or UI clutter — just the text and images.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
  {
    title: 'Full threads',
    description: 'Automatically fetches and combines every tweet in the thread.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    ),
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <svg className="h-4 w-4 text-surface" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-[var(--color-text)]">Thread to PDF</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href={PAYPAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              dir="rtl"
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-2.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[#0070BA]/40 hover:text-[var(--color-text)] sm:px-3 sm:py-2"
              aria-label="إذا أردت دعم تطبيقي عبر PayPal"
            >
              <PayPalIcon className="h-6 w-6 shrink-0" />
              <span className="hidden max-w-[9rem] leading-snug sm:inline">
                إذا أردت دعم تطبيقي
              </span>
              <span className="sm:hidden">ادعم التطبيق</span>
            </a>
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main>
        <section className="py-16 sm:py-24">
          <Container>
            <div className="text-center animate-slide-up">
              <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] sm:text-5xl lg:text-6xl">
                Threads, beautifully
                <span className="block text-muted font-normal mt-1">printed.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--color-text-secondary)] leading-relaxed">
                Transform any public X thread into a professionally typeset PDF document.
                Clean typography, no clutter — just the content you want to read and keep.
              </p>
            </div>

            <div className="mt-12 animate-fade-in" style={{ animationDelay: '0.15s' }}>
              <GenerateForm />
            </div>
          </Container>
        </section>

        <section className="border-t border-border bg-surface-elevated py-16 sm:py-20">
          <Container>
            <div className="grid gap-8 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="text-center sm:text-left">
                  <div className="mx-auto sm:mx-0 mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
                    <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      {feature.icon}
                    </svg>
                  </div>
                  <h3 className="font-semibold text-[var(--color-text)]">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <Container>
          <p className="text-center text-sm text-muted">
            Thread to PDF — Convert X threads into elegant documents
          </p>
        </Container>
      </footer>
    </div>
  );
}
