import type { LeadStage } from '@/types/lead';

export function LeadStageLabel({ stage }: { stage: LeadStage }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
      {stage.name}
    </span>
  );
}
