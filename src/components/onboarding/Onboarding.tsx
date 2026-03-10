'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { SeoLevel, AccountType, BusinessGoal, AgentTone } from '@/types/profile';

import { StepName }       from './StepName';
import { StepKnowledge }  from './StepKnowledge';
import { StepClientType } from './StepClientType';
import { StepDomain }     from './StepDomain';
import { StepGoal }       from './StepGoal';
import { StepTone }       from './StepTone';
import { StepGsc }        from './StepGsc';

// ─── Form state ──────────────────────────────────────────────────────────────

interface FormData {
  firstName:    string;
  seoLevel:     SeoLevel | '';
  accountType:  AccountType | '';
  projectName:  string;
  companyName:  string;
  domain:       string;
  teamSize:     string;
  businessGoal: BusinessGoal | '';
  agentTone:    AgentTone | '';
  gscConnected: boolean;
}

const INITIAL: FormData = {
  firstName:    '',
  seoLevel:     '',
  accountType:  '',
  projectName:  '',
  companyName:  '',
  domain:       '',
  teamSize:     '',
  businessGoal: '',
  agentTone:    '',
  gscConnected: false,
};

const TOTAL_STEPS = 7;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { saveProfile } = useAuth();
  const router          = useRouter();

  const [step,       setStep]       = useState(1);
  const [direction,  setDirection]  = useState(1);
  const [saving,     setSaving]     = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [formData,   setFormData]   = useState<FormData>(INITIAL);

  // Generic typed field setter
  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  // ── Per-step validation ─────────────────────────────────────────────────────
  const isStepValid = (): boolean => {
    switch (step) {
      case 1: return formData.firstName.trim() !== '';
      case 2: return formData.seoLevel !== '';
      case 3: return formData.accountType !== '';
      case 4:
        if (formData.accountType === 'freelancer')
          return formData.projectName.trim() !== '' && formData.domain.trim() !== '';
        return (
          formData.companyName.trim() !== '' &&
          formData.domain.trim() !== '' &&
          formData.teamSize !== ''
        );
      case 5: return formData.businessGoal !== '';
      case 6: return formData.agentTone !== '';
      case 7: return true; // GSC is optional
      default: return true;
    }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = () => {
    if (!isStepValid()) return;
    if (step === TOTAL_STEPS) {
      handleComplete();
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  // ── Enter key ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, formData]);

  // ── Loading messages ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!saving) return;
    const domain = formData.domain;
    const msgs = [
      domain ? `Skanowanie domeny ${domain}...` : 'Skanowanie domeny...',
      'Konfiguracja Agenta SEO...',
      'Przygotowywanie pierwszego raportu...',
    ];
    let i = 0;
    setLoadingMsg(msgs[0]);
    const id = setInterval(() => {
      i = (i + 1) % msgs.length;
      setLoadingMsg(msgs[i]);
    }, 1500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]);

  // ── Firebase save ───────────────────────────────────────────────────────────
  const handleComplete = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveProfile({
          onboardingCompleted: true,
          firstName:    formData.firstName,
          seoLevel:     formData.seoLevel     as SeoLevel,
          accountType:  formData.accountType  as AccountType,
          projectName:  formData.projectName  || undefined,
          companyName:  formData.companyName  || undefined,
          domain:       formData.domain,
          teamSize:     formData.teamSize     || undefined,
          businessGoal: formData.businessGoal as BusinessGoal,
          agentTone:    formData.agentTone    as AgentTone,
          gscConnected: formData.gscConnected,
        }),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ]);
    } finally {
      router.push('/dashboard/chat');
    }
  };

  // ── Step renderer ───────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <StepName
            value={formData.firstName}
            onChange={(v) => set('firstName', v)}
          />
        );
      case 2:
        return (
          <StepKnowledge
            value={formData.seoLevel}
            onChange={(v) => set('seoLevel', v)}
          />
        );
      case 3:
        return (
          <StepClientType
            value={formData.accountType}
            onChange={(v) => set('accountType', v)}
          />
        );
      case 4:
        return (
          <StepDomain
            accountType={formData.accountType}
            projectName={formData.projectName}
            companyName={formData.companyName}
            domain={formData.domain}
            teamSize={formData.teamSize}
            onProjectName={(v) => set('projectName', v)}
            onCompanyName={(v) => set('companyName', v)}
            onDomain={(v) => set('domain', v)}
            onTeamSize={(v) => set('teamSize', v)}
          />
        );
      case 5:
        return (
          <StepGoal
            value={formData.businessGoal}
            onChange={(v) => set('businessGoal', v)}
          />
        );
      case 6:
        return (
          <StepTone
            value={formData.agentTone}
            onChange={(v) => set('agentTone', v)}
          />
        );
      case 7:
        return (
          <StepGsc
            connected={formData.gscConnected}
            onConnect={() => set('gscConnected', true)}
          />
        );
      default:
        return null;
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const valid      = isStepValid();
  const isLastStep = step === TOTAL_STEPS;
  const pct        = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);

  const stepVariants = {
    enter:  (dir: number) => ({ y: dir > 0 ?  24 : -24, opacity: 0 }),
    center:             () => ({ y: 0,                   opacity: 1 }),
    exit:   (dir: number) => ({ y: dir > 0 ? -24 :  24, opacity: 0 }),
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-black">

      {/* Purple glow blob */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-900/10 blur-[140px]" />

      {/* Progress bar ── fixed top */}
      <div className="fixed left-0 top-0 z-40 h-1 w-full bg-zinc-900">
        <motion.div
          className="h-full bg-purple-600"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Logo ── fixed top-left */}
      <div className="fixed left-6 top-4 z-40">
        <span className="text-sm font-bold tracking-tight text-white">Bress.io</span>
      </div>

      {/* Main content ── vertically & horizontally centered */}
      <div className="flex min-h-screen items-center justify-center px-6 py-24">
        <div className="w-full max-w-2xl">

          {/* Animated step card */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <div className="py-2">
                {renderStep()}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Wstecz
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={goNext}
              disabled={!valid}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-base font-semibold transition-all duration-200 ${
                valid
                  ? 'bg-purple-600 text-white hover:bg-purple-500 hover:-translate-y-0.5'
                  : 'cursor-not-allowed border border-white/5 bg-zinc-900 text-zinc-500'
              }`}
            >
              {isLastStep ? 'Zakończ i analizuj' : 'Dalej'}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

        </div>
      </div>

      {/* Loading overlay */}
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-6">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingMsg}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-base font-medium text-white"
              >
                {loadingMsg}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      )}

    </div>
  );
}
