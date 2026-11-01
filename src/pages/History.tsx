import { Link, useSearchParams } from 'react-router-dom';
import { ProgressView } from './Progress';
import { TrainingCalendar } from '../components/TrainingCalendar';
import { fmtDate, fmtDuration } from '../format';
import { useFinished, useSettings } from '../hooks';
import { workoutVolume } from '../logic/stats';
import { fmtWeight } from '../logic/units';

export function History() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'progress' ? 'progress' : 'log';

  return (
    <>
      <header className="page-head">
        <h1>{tab === 'progress' ? 'Progress' : 'History'}</h1>
        <div className="segmented">
          <button className={tab === 'log' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>Log</button>
          <button className={tab === 'progress' ? 'on' : ''} onClick={() => setParams({ tab: 'progress' }, { replace: true })}>Progress</button>
        </div>
      </header>
      {tab === 'progress' ? <ProgressView /> : <HistoryLog />}
    </>
  );
}

function HistoryLog() {
  const finished = useFinished();
  const { units } = useSettings();
  return (
    <>
      <p className="muted">{finished?.length ?? 0} workouts logged</p>
      {finished && finished.length > 0 && <TrainingCalendar workouts={finished} />}
      {finished?.length === 0 && <p className="muted">Finish your first workout and it will show up here.</p>}
      <ul className="list">
        {finished?.map((w) => (
          <li key={w.id}>
            <Link className="list-item" to={`/history/${w.id}`}>
              <span>
                <strong>{w.name}</strong>
                <small className="muted">
                  {fmtDate(w.startedAt)} · {fmtDuration(w.finishedAt! - w.startedAt)} · {fmtWeight(workoutVolume(w), units)} volume
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
