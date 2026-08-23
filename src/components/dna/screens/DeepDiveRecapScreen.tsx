import { generateDomainRecap, hasEarnedDomainNuance } from '@/lib/dna/domains';
import { getInsightFeedback } from '@/lib/dna/calibration-feedback';
import { InsightRating } from '../InsightRating';
import { CalibrationMeter } from '../CalibrationMeter';
import type { CalibrationResponse, DnaCard, DnaState, DomainDef } from '@/lib/dna/types';

export function DeepDiveRecapScreen({
  domainKey,
  dnaState,
  cards,
  domains,
  recalibrating,
  onContinue,
  onRateInsight,
}: {
  domainKey: string;
  dnaState: DnaState;
  cards: DnaCard[];
  domains: DomainDef[];
  recalibrating: boolean;
  onContinue: () => void;
  onRateInsight: (targetType: 'domain', targetId: string, title: string, response: CalibrationResponse) => void;
}) {
  const def = domains.find((d) => d.key === domainKey);
  const label = def?.label || domainKey;
  const body = generateDomainRecap(domainKey, dnaState, cards, domains);
  // Nothing to rate the accuracy of when there was no real conclusion —
  // the body text is just "still zeroing in," not a claim we asked the
  // user to confirm.
  const earnedInsight = hasEarnedDomainNuance(domainKey, dnaState, cards);

  return (
    <div className="dna-screen dna-domain-recap">
      <CalibrationMeter percent={dnaState.calibrationPercent} recalibrating={recalibrating} />
      <div className="dna-domain-recap-card">
        <div className="dna-domain-recap-emoji">{def?.emoji || '✨'}</div>
        <div className="dna-domain-recap-kicker">{label} — deep dive complete</div>
        <div className="dna-domain-recap-title">
          Great, here&apos;s what we know about you and your preferences for {label.toLowerCase()} on a trip:
        </div>
        <p className="dna-domain-recap-body">{body}</p>
        {earnedInsight && (
          <InsightRating
            feedback={getInsightFeedback(dnaState, 'domain', domainKey)}
            disabled={recalibrating}
            onRate={(response) => onRateInsight('domain', domainKey, body, response)}
          />
        )}
        <button className="btn-primary" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
