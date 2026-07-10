import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ApiError } from '@thread-to-pdf/shared';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useToast } from '@/contexts/ToastContext';
import { generatePdf, getErrorMessage, type GenerateResult } from '@/lib/api';

const formSchema = z.object({
  url: z
    .string()
    .min(1, 'Please enter a thread URL')
    .url('Please enter a valid URL')
    .refine(
      (url) => /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i.test(url) || /(?:twitter\.com|x\.com)\/i\/status\/\d+/i.test(url),
      'Please enter a valid X (Twitter) thread URL',
    ),
});

type FormData = z.infer<typeof formSchema>;

type GenerationState = 'idle' | 'loading' | 'success' | 'error';

const LOADING_STEPS = [
  { progress: 15, label: 'Fetching thread…' },
  { progress: 40, label: 'Extracting content…' },
  { progress: 65, label: 'Building document…' },
  { progress: 85, label: 'Generating PDF…' },
  { progress: 95, label: 'Almost done…' },
];

export function GenerateForm() {
  const [state, setState] = useState<GenerationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: '' },
  });

  const urlValue = watch('url');

  useEffect(() => {
    if (state !== 'loading') return;

    let stepIndex = 0;
    setProgress(LOADING_STEPS[0].progress);
    setProgressLabel(LOADING_STEPS[0].label);

    const interval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, LOADING_STEPS.length - 1);
      setProgress(LOADING_STEPS[stepIndex].progress);
      setProgressLabel(LOADING_STEPS[stepIndex].label);
    }, 2500);

    return () => clearInterval(interval);
  }, [state]);

  const onSubmit = async (data: FormData) => {
    setState('loading');
    setErrorMessage(null);
    setResult(null);
    setProgress(5);
    setProgressLabel('Starting…');

    try {
      const pdfResult = await generatePdf({ url: data.url });
      setProgress(100);
      setProgressLabel('Complete!');
      setResult(pdfResult);
      setState('success');
      showToast('PDF generated successfully!', 'success');
    } catch (error) {
      const apiError = error as ApiError;
      setErrorMessage(getErrorMessage(apiError));
      setState('error');
    }
  };

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const text = e.dataTransfer.getData('text/plain').trim();
    if (text && (text.includes('x.com') || text.includes('twitter.com'))) {
      setValue('url', text, { shouldValidate: true });
    }
  };

  const handleReset = () => {
    setState('idle');
    setErrorMessage(null);
    setResult(null);
    setProgress(0);
  };

  return (
    <Card
      variant="elevated"
      className={`transition-all duration-300 ${isDragging ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Generate PDF form">
        <div className="space-y-4">
          <div>
            <label htmlFor="thread-url" className="sr-only">
              X thread URL
            </label>
            <Input
              id="thread-url"
              type="url"
              placeholder="https://x.com/username/status/1234567890"
              error={!!errors.url}
              disabled={state === 'loading'}
              aria-describedby={errors.url ? 'url-error' : 'url-hint'}
              {...register('url')}
            />
            {errors.url ? (
              <p id="url-error" className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {errors.url.message}
              </p>
            ) : (
              <p id="url-hint" className="mt-2 text-sm text-muted">
                Paste a public X thread URL or drag and drop it here
              </p>
            )}
          </div>

          {state === 'loading' && (
            <div className="py-6 animate-fade-in">
              <Loader size="md" label={progressLabel} className="mb-6" />
              <ProgressBar progress={progress} label={progressLabel} />
            </div>
          )}

          {state === 'error' && errorMessage && (
            <ErrorAlert message={errorMessage} onDismiss={() => setState('idle')} />
          )}

          {state === 'success' && result && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30 animate-fade-in">
              <p className="font-medium text-green-800 dark:text-green-300">
                Your PDF is ready!
              </p>
              <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                {result.contentChars
                  ? `Captured ${result.contentChars.toLocaleString()} characters`
                  : 'Download your beautifully formatted document below.'}
                {result.tweetCount && result.tweetCount > 1
                  ? ` across ${result.tweetCount} tweets.`
                  : result.contentChars
                    ? ' of content.'
                    : ''}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {state === 'success' ? (
              <>
                <Button type="button" size="lg" onClick={handleDownload} className="flex-1">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </Button>
                <Button type="button" variant="secondary" size="lg" onClick={handleReset}>
                  Convert Another
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                size="lg"
                isLoading={state === 'loading'}
                disabled={state === 'loading' || !urlValue}
                className="w-full sm:w-auto sm:min-w-[200px]"
              >
                {state === 'loading' ? 'Generating…' : 'Generate PDF'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
