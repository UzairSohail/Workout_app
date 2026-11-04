import type { Exercise } from '../types';
import { MOVE_BY_ID, TARGETS, type Target } from './targets';

type Hits = Partial<Record<Target, number>>;

/**
 * Which part of each muscle an exercise works. Hand-tagged exercises (the ones the routine builder uses)
 * come from targets.ts; for everything else in the library, and custom exercises, it's worked out from
 * the name and main muscles using the same rules a coach would: incline means upper chest, overhead
 * means triceps long head, preacher means biceps short head, seated calf raise means soleus, and so on.
 */
export function subAreas(ex: Exercise | undefined): Hits {
  if (!ex) return {};
  const tagged = MOVE_BY_ID.get(ex.id);
  if (tagged) return tagged.hits;
  const n = ex.name.toLowerCase();
  const has = (re: RegExp) => re.test(n);
  const out: Hits = {};
  const set = (t: Target, w: number) => { out[t] = Math.max(out[t] ?? 0, w); };

  for (const m of ex.primaryMuscles) {
    switch (m) {
      case 'chest':
        if (has(/incline|low.?(cable|pulley)|low to high|feet elevated|decline push/)) set('chestUpper', 1);
        else if (has(/decline|dip|high.?(cable|pulley)|high to low|hands elevated|incline push/)) set('chestLower', 1);
        else set('chestMid', 1);
        if (has(/press|push/)) set('deltFront', 0.4);
        break;
      case 'shoulders':
        if (has(/rear|reverse fl|face pull|bent.?over.*(lateral|raise|fly)|pull.?apart|back fl/)) set('deltRear', 1);
        else if (has(/lateral|side raise|upright/)) set('deltSide', 1);
        else { set('deltFront', 1); if (has(/press/)) set('deltSide', 0.4); }
        break;
      case 'biceps':
        if (has(/hammer|reverse|cross.?body|zottman|neutral/)) { set('brachialis', 1); set('bicepsLong', 0.5); }
        else if (has(/preacher|concentration|spider|scott|wide.?grip|prone|high.?cable|overhead cable/)) { set('bicepsShort', 1); set('bicepsLong', 0.4); }
        else if (has(/incline|drag|bayesian|behind|close.?grip|narrow/)) { set('bicepsLong', 1); set('bicepsShort', 0.4); }
        else { set('bicepsShort', 0.8); set('bicepsLong', 0.8); }
        break;
      case 'triceps':
        if (has(/overhead|french|behind the head|above head|standing.*extension|seated.*extension/)) { set('tricepsLong', 1); set('tricepsOuter', 0.4); }
        else if (has(/skull|lying|incline.*extension|decline.*extension|jm press/)) { set('tricepsLong', 0.7); set('tricepsOuter', 0.7); }
        else { set('tricepsOuter', 1); set('tricepsLong', 0.4); }
        break;
      case 'lats':
        set('lats', 1);
        if (has(/row/)) set('upperBack', 0.6);
        break;
      case 'middle back':
        set('upperBack', 1);
        if (has(/row|pull/)) set('lats', 0.5);
        break;
      case 'lower back': set('lowerBack', 1); break;
      case 'traps': set('traps', 1); break;
      case 'quadriceps':
        if (has(/extension|sissy/)) set('rectusFemoris', 1);
        set('quads', has(/extension/) ? 0.6 : 1);
        if (has(/squat|lunge|step|press|split/)) set('glutes', 0.6);
        break;
      case 'hamstrings':
        if (has(/curl|nordic|glute.?ham/)) set('hamsKnee', 1);
        else { set('hamsHip', 1); set('glutes', 0.6); }
        break;
      case 'glutes':
        if (has(/abduct|clam|side.?(lying|leg)|monster|lateral band|fire hydrant/)) set('gluteSide', 1);
        else set('glutes', 1);
        break;
      case 'abductors': set('gluteSide', 1); break;
      case 'calves':
        if (has(/seated|bent.?knee/)) { set('soleus', 1); set('gastroc', 0.3); }
        else { set('gastroc', 1); set('soleus', 0.4); }
        break;
      case 'abdominals':
        if (has(/oblique|twist|side|woodchop|wood chop|pallof|rotation|windshield/)) set('obliques', 1);
        else if (has(/leg raise|leg lift|reverse crunch|knee raise|knee tuck|pull.?in|hanging|flutter|scissor/)) { set('lowerAbs', 1); set('abs', 0.5); }
        else set('abs', 1);
        break;
    }
  }
  return out;
}

/** The parts an exercise mainly trains, strongest first, as labels. */
export function subAreaLabels(ex: Exercise | undefined, min = 0.6): string[] {
  return (Object.entries(subAreas(ex)) as [Target, number][])
    .filter(([, w]) => w >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => TARGETS[t].label);
}
