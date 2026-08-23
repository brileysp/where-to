import { calculateDimensionScores, getStrongestDimensions } from '@/lib/dna/dimensions';
import { detectTensions, getStrongestTensions } from '@/lib/dna/tensions';
import { generateLearningObservations, generateStillTestingAreas } from '@/lib/dna/summary';
import { generateEvidenceForDimension, generateEvidenceForTension } from '@/lib/dna/evidence';
import { getInsightFeedback } from '@/lib/dna/calibration-feedback';
import { EvidenceDetails } from '../EvidenceDetails';
import { InsightRating } from '../InsightRating';
import { CalibrationMeter } from '../CalibrationMeter';
import type { CalibrationResponse, DimensionDef, DnaCard, DnaState, DomainDef, TensionDef } from '@/lib/dna/types';

interface Props {
  dnaState: DnaState;
  cards: DnaCard[];
  dimensions: DimensionDef[];
  tensions: TensionDef[];
  domains: DomainDef[];
  recalibrating: boolean;
  onContinue: () => void;
  onKeepSwiping: () => void;
  onReset: () => void;
  onBack: () => void;
  onRateInsight: (targetType: 'dimension' | 'tension', targetId: string, title: string, response: CalibrationResponse) => void;
}

export function SummaryScreen({
  dnaState,
  cards,
  dimensions,
  tensions,
  domains,
  recalibrating,
  onContinue,
  onKeepSwiping,
  onReset,
  onBack,
  onRateInsight,
}: Props) {
  const headline =
    dnaState.calibrationPercent >= 100
      ? 'Profile calibrated. You can keep refining it anytime.'
      : `${dnaState.calibrationPercent}% calibrated so far.`;

  const strongestDims = getStrongestDimensions(dnaState, dimensions, 5);
  const strongestTensions = getStrongestTensions(dnaState, cards, tensions, 4);
  const learningItems = generateLearningObservations(
    dnaState,
    cards,
    dimensions,
    tensions,
    strongestDims.map((d) => d.id),
    strongestTensions.map((t) => t.id),
    3,
  );
  const stillTesting = generateStillTestingAreas(dnaState, cards, dimensions, tensions, domains, 5);

  const allDimResults = calculateDimensionScores(dnaState, dimensions);
  const allTensionResults = detectTensions(dnaState, cards, tensions);

  return (
    <div className="dna-screen dna-summary">
      {dnaState.completedOnboarding && (
        <button className="dna-back-link" onClick={onBack}>
          ← Back to recommendations
        </button>
      )}
      <h1>Your Travel DNA</h1>
      <p className="dna-summary-intro">
        Here&apos;s what your swipes are starting to reveal. This is a working model, not a final verdict.
      </p>
      <CalibrationMeter percent={dnaState.calibrationPercent} recalibrating={recalibrating} />
      <p className="dna-summary-sub">{headline}</p>

      {strongestDims.length > 0 ? (
        <div className="dna-summary-section">
          <h3>Strongest travel signals</h3>
          {strongestDims.map((d) => (
            <div key={d.id} className="dna-dim-row">
              <div className="dna-dim-labels">
                <span className={d.leadingPole === d.poleA ? 'dna-dim-label-lead' : ''}>
                  {d.poleA} {d.poleAScore}%
                </span>
                <span className={d.leadingPole === d.poleB ? 'dna-dim-label-lead' : ''}>
                  {d.poleB} {d.poleBScore}%
                </span>
              </div>
              <div className="dna-dim-bar">
                <div className="dna-dim-bar-fill" style={{ width: `${d.poleAScore}%` }} />
              </div>
              <p className="dna-dim-summary">{d.summary}</p>
              <EvidenceDetails evidence={generateEvidenceForDimension(dnaState, cards, d, dimensions)} allCards={cards} />
              <InsightRating
                feedback={getInsightFeedback(dnaState, 'dimension', d.id)}
                disabled={recalibrating}
                onRate={(response) => onRateInsight('dimension', d.id, d.summary, response)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="dna-summary-section">
          <p className="dna-summary-empty">Still gathering signal — keep swiping.</p>
        </div>
      )}

      {strongestTensions.length > 0 && (
        <div className="dna-summary-section">
          <h3>Interesting tensions</h3>
          {strongestTensions.map((t) => (
            <div key={t.id} className="dna-tension-card">
              <div className="dna-tension-title">
                {t.title}
                {t.status === 'confirmed' && <span className="dna-tension-confirmed"> ✓ confirmed</span>}
              </div>
              <p className="dna-tension-text">{t.insightText}</p>
              <p className="dna-tension-why">
                <strong>Why it matters:</strong> {t.recommendationImplication}
              </p>
              <EvidenceDetails evidence={generateEvidenceForTension(dnaState, cards, t, tensions)} allCards={cards} />
              <InsightRating
                feedback={getInsightFeedback(dnaState, 'tension', t.id)}
                disabled={recalibrating}
                onRate={(response) => onRateInsight('tension', t.id, t.title, response)}
              />
            </div>
          ))}
        </div>
      )}

      {learningItems.length > 0 && (
        <div className="dna-summary-section">
          <h3>What we&apos;re learning</h3>
          {learningItems.map((item, i) => {
            const evidence =
              item.kind === 'dimension'
                ? generateEvidenceForDimension(dnaState, cards, allDimResults.find((d) => d.id === item.id)!, dimensions)
                : generateEvidenceForTension(dnaState, cards, allTensionResults.find((t) => t.id === item.id)!, tensions);
            return (
              <div key={i} className="dna-learning-item">
                <p className="dna-learning-text">{item.text}</p>
                <EvidenceDetails evidence={evidence} allCards={cards} />
                <InsightRating
                  feedback={getInsightFeedback(dnaState, item.kind, item.id)}
                  disabled={recalibrating}
                  onRate={(response) => onRateInsight(item.kind, item.id, item.text, response)}
                />
              </div>
            );
          })}
        </div>
      )}

      {stillTesting.length > 0 && (
        <div className="dna-summary-section">
          <h3>Still testing</h3>
          <ul className="dna-summary-list dna-still-testing-list">
            {stillTesting.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="dna-summary-buttons">
        <button className="btn-primary" onClick={onContinue}>
          Continue to recommendations
        </button>
        <button className="dna-btn-secondary" onClick={onKeepSwiping}>
          Keep refining my Travel DNA
        </button>
        <button className="dna-btn-secondary dna-btn-danger" onClick={onReset}>
          Reset Travel DNA
        </button>
      </div>
    </div>
  );
}
