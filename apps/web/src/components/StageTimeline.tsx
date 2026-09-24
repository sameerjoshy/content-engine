export interface StageDef {
  key: string;
  name: string;
  hint: string;
}

export const STAGES: StageDef[] = [
  { key: 'validator', name: 'Check Angle', hint: 'Is this angle distinct from your existing content?' },
  { key: 'researcher', name: 'Research', hint: 'Real sources, evidence table, no invented facts.' },
  { key: 'research_review', name: 'Review Research', hint: 'Approve or steer the evidence before writing.' },
  { key: 'spec_builder', name: 'Build Spec', hint: 'Turning your inputs into exact writer instructions.' },
  { key: 'sowhat', name: 'Demand Check', hint: 'Is this question actually burning right now? Kills or steers cold demand.' },
  { key: 'pov', name: 'Proprietary POV', hint: 'The operator\'s experience-based insight — or an honest analytical POV.' },
  { key: 'writer', name: 'Write Draft', hint: 'Article written from the spec + evidence.' },
  { key: 'editor', name: 'Edit & Polish', hint: 'Fact-check against evidence, tone, structure.' },
];

type StageState = 'complete' | 'current' | 'pending' | 'error';

export function getStageStates(
  currentStage: string,
  status: string,
  erroredStages: Set<string>,
): StageState[] {
  const order = STAGES.map((s) => s.key);
  const idx = order.indexOf(currentStage);
  return STAGES.map((s, i) => {
    if (erroredStages.has(s.key)) return 'error';
    if (status === 'complete') return 'complete';
    // The research_review stage is skipped when the run doesn't pause for review.
    if (s.key === 'research_review' && idx < 0) return 'pending';
    if (status === 'awaiting_review') return s.key === 'research_review' ? 'current' : i < idx ? 'complete' : 'pending';
    if (i < idx) return 'complete';
    if (i === idx) return 'current';
    return 'pending';
  });
}

const ICON: Record<StageState, string> = {
  complete: '✓',
  current: '⏳',
  pending: '◯',
  error: '✕',
};

export default function StageTimeline({
  currentStage,
  status,
  erroredStages = new Set(),
  messages,
}: {
  currentStage: string;
  status: string;
  erroredStages?: Set<string>;
  messages: Record<string, string>;
}) {
  const states = getStageStates(currentStage, status, erroredStages);
  return (
    <div className="stage-list">
      {STAGES.map((s, i) => {
        const st = states[i];
        const cls = st === 'current' ? ' current' : st === 'error' ? ' error' : '';
        return (
          <div key={s.key} className={`stage-item${cls}`}>
            <div className="stage-icon" style={st === 'current' ? { display: 'inline-flex' } : undefined}>
              {st === 'current' ? <span className="spinner" /> : ICON[st]}
            </div>
            <div className="stage-body">
              <div className="stage-name">{s.name}</div>
              <div className="stage-msg">
                {st === 'error' ? messages[s.key] || 'Stage failed' : messages[s.key] || s.hint}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}