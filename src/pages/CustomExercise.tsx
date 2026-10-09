import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomExerciseForm } from '../components/CustomExerciseForm';

export function CustomExercise() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <>
      <header className="page-head">
        <button className="ghost back" onClick={() => navigate(-1)}>‹ Back</button>
        <h1>Custom exercise</h1>
      </header>
      <CustomExerciseForm initialName={params.get('name') ?? ''} initialMuscle={params.get('muscle') ?? ''}
        onSaved={(e) => navigate(`/exercises/${e.id}`, { replace: true })} />
    </>
  );
}
