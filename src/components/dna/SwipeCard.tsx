'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'motion/react';
import { CATEGORY_VISUALS, DEFAULT_CATEGORY_VISUAL } from '@/lib/dna/card-visuals';
import type { DnaCard, SwipeType } from '@/lib/dna/types';

const DISTANCE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;
const FLY_OUT_DISTANCE = 700;
const EXIT_DURATION = 0.25;

interface Props {
  card: DnaCard;
  onSwipe: (type: SwipeType) => void;
  /** Set by the parent (buttons/keyboard) to trigger the same fly-off animation as a drag commit. */
  triggerSwipe: SwipeType | null;
  onTriggerConsumed: () => void;
}

export function SwipeCard({ card, onSwipe, triggerSwipe, onTriggerConsumed }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  // Reacts almost immediately ("as you start swiping") and reaches full
  // opacity right around the commit threshold, so the badge is fully
  // confirmed by the moment a release would actually count.
  const noOpacity = useTransform(x, [-DISTANCE_THRESHOLD, -15], [1, 0]);
  const yesOpacity = useTransform(x, [15, DISTANCE_THRESHOLD], [0, 1]);
  const loveOpacity = useTransform(y, [-DISTANCE_THRESHOLD, -15], [1, 0]);

  useEffect(() => {
    if (!triggerSwipe) return;
    if (triggerSwipe === 'love') {
      animate(y, -FLY_OUT_DISTANCE, { duration: EXIT_DURATION, ease: 'easeIn' });
    } else {
      animate(x, triggerSwipe === 'yes' ? FLY_OUT_DISTANCE : -FLY_OUT_DISTANCE, {
        duration: EXIT_DURATION,
        ease: 'easeIn',
      });
    }
    const timer = setTimeout(() => {
      onTriggerConsumed();
      onSwipe(triggerSwipe);
    }, EXIT_DURATION * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSwipe]);

  function commitSwipe(type: SwipeType) {
    if (type === 'love') {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
      animate(y, -FLY_OUT_DISTANCE, { duration: EXIT_DURATION, ease: 'easeIn' });
    } else {
      animate(x, type === 'yes' ? FLY_OUT_DISTANCE : -FLY_OUT_DISTANCE, { duration: EXIT_DURATION, ease: 'easeIn' });
    }
    setTimeout(() => onSwipe(type), EXIT_DURATION * 1000);
  }

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.y < -DISTANCE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
      commitSwipe('love');
      return;
    }
    if (offset.x > DISTANCE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      commitSwipe('yes');
      return;
    }
    if (offset.x < -DISTANCE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      commitSwipe('no');
      return;
    }
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 });
  }

  const visuals = CATEGORY_VISUALS[card.category] || DEFAULT_CATEGORY_VISUAL;

  return (
    <motion.div className="dna-card" style={{ x, y, rotate }} drag onDragEnd={handleDragEnd}>
      <div
        className="dna-card-visual"
        style={{ background: `linear-gradient(160deg, ${visuals.gradient[0]}, ${visuals.gradient[1]})` }}
      >
        <div className="dna-card-emoji">{visuals.emoji}</div>
        <motion.div className="dna-card-swipe-badge no" style={{ opacity: noOpacity }}>
          NO
        </motion.div>
        <motion.div className="dna-card-swipe-badge yes" style={{ opacity: yesOpacity }}>
          YES
        </motion.div>
        <motion.div className="dna-card-swipe-badge love" style={{ opacity: loveOpacity }}>
          LOVE
        </motion.div>
      </div>
      <div className="dna-card-body">
        <div className="dna-card-category">{card.category}</div>
        <h2 className="dna-card-title">{card.title}</h2>
        <p className="dna-card-desc">{card.description}</p>
        <div className="dna-card-tags">
          {card.tags.map((t) => (
            <span key={t} className="dna-tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
