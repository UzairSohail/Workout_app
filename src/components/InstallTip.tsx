import { dismissInstallTip, promptInstall, useInstallTip } from '../install';
import { PhoneIcon, ShareIcon, XIcon } from './Icons';

/** A one-line tip on Today until the app is on the home screen (or you close it). */
export function InstallTip() {
  const tip = useInstallTip();
  if (!tip) return null;
  return (
    <section className="card backup-nudge install-tip">
      <span className="lead-ico neutral"><PhoneIcon /></span>
      {tip === 'ios' ? (
        <span className="grow small">
          Add the app to your Home Screen: tap <span className="inline-ico" aria-label="Share"><ShareIcon /></span> Share, then <strong>Add to Home Screen</strong>. Rest alerts and full screen only work from there.
        </span>
      ) : (
        <>
          <span className="grow small">Install the app for full screen and rest alerts.</span>
          <button className="secondary" onClick={() => promptInstall().catch(() => {})}>Install</button>
        </>
      )}
      <button className="ghost icon-btn" aria-label="Hide this tip" onClick={dismissInstallTip}><XIcon /></button>
    </section>
  );
}
