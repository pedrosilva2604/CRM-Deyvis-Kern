export const DEFAULT_PIPELINE_STAGES = [
  { name: 'Novo lead', color: '#3b82f6', position: 0, isWon: false, isLost: false },
  { name: 'Em atendimento', color: '#f59e0b', position: 1, isWon: false, isLost: false },
  { name: 'Proposta', color: '#8b5cf6', position: 2, isWon: false, isLost: false },
  { name: 'Ganho', color: '#22c55e', position: 3, isWon: true, isLost: false },
  { name: 'Perdido', color: '#ef4444', position: 4, isWon: false, isLost: true },
];

export function defaultPipelineNameFor(ownerName: string): string {
  return `Funil de ${ownerName}`;
}
