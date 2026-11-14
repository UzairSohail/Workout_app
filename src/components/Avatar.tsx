import type { ReactNode } from 'react';
import { initials } from '../format';
import type { Settings } from '../types';
import { UserIcon } from './Icons';

/*
 * Profile pictures. Silhouettes and animals are one-colour shapes drawn in the theme's accent, with
 * details cut out in the circle's colour (.cut), so they suit every theme. The chick is the app icon's art.
 */
const Shape = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 48 48" className="avatar-art" aria-hidden fill="currentColor">{children}</svg>
);

export const AVATARS: { id: string; name: string; art: ReactNode }[] = [
  { id: 'chick', name: 'Chick', art: <img className="avatar-art" src="avatars/chick.png" alt="" /> },
  {
    id: 'man', name: 'Man', art: (
      <Shape>
        <circle cx="24" cy="18" r="8.5" />
        <path d="M15.5 16.5c0-6 3.8-9.5 8.5-9.5s8.5 3.5 8.5 9.5c-1.5-2.6-4.4-4-8.5-4s-7 1.4-8.5 4z" />
        <path d="M6 48c0-10 8-17 18-17s18 7 18 17z" />
      </Shape>
    ),
  },
  {
    id: 'woman', name: 'Woman', art: (
      <Shape>
        <path d="M13 31c2-3 2.6-6.5 2.6-12C15.6 11.5 19.3 7 24 7s8.4 4.5 8.4 12c0 5.5.6 9 2.6 12-3 1.6-6.6 2.3-11 2.3S16 32.6 13 31z" />
        <path d="M8 48c0-9 7-15 16-15s16 6 16 15z" />
      </Shape>
    ),
  },
  {
    id: 'bear', name: 'Bear', art: (
      <Shape>
        <circle cx="13" cy="14" r="6.5" /><circle cx="35" cy="14" r="6.5" />
        <circle cx="24" cy="27" r="15" />
        <circle className="cut" cx="13" cy="14" r="2.8" /><circle className="cut" cx="35" cy="14" r="2.8" />
        <circle className="cut" cx="18.5" cy="24" r="1.8" /><circle className="cut" cx="29.5" cy="24" r="1.8" />
        <ellipse className="cut" cx="24" cy="32" rx="6.5" ry="5" />
        <ellipse cx="24" cy="30.2" rx="2.6" ry="1.8" />
      </Shape>
    ),
  },
  {
    id: 'fox', name: 'Fox', art: (
      <Shape>
        <path d="M7 7l11 8h12l11-8-2 18-15 16L9 25z" />
        <path className="cut" d="M12 13l4 4-3 4zM36 13l-4 4 3 4z" />
        <circle className="cut" cx="18" cy="24" r="1.8" /><circle className="cut" cx="30" cy="24" r="1.8" />
        <path className="cut" d="M15 29c3 1 6 1.5 9 1.5s6-.5 9-1.5l-9 9.5z" />
        <circle cx="24" cy="33" r="1.8" />
      </Shape>
    ),
  },
  {
    id: 'cat', name: 'Cat', art: (
      <Shape>
        <path d="M9 8l9 7.5h12L39 8v17c0 9-6.5 15-15 15S9 34 9 25z" />
        <path className="cut" d="M17 23.5c1.2-1.6 3.2-1.6 4.4 0-1.2 1.6-3.2 1.6-4.4 0zM26.6 23.5c1.2-1.6 3.2-1.6 4.4 0-1.2 1.6-3.2 1.6-4.4 0z" />
        <path className="cut" d="M22 29h4l-2 2.2z" />
        <path d="M2 27l11 1.5M2 32l11-1.5M46 27l-11 1.5M46 32l-11-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </Shape>
    ),
  },
  {
    id: 'owl', name: 'Owl', art: (
      <Shape>
        <path d="M10 8l7 6h14l7-6v20c0 10-6 16-14 16S10 38 10 28z" />
        <circle className="cut" cx="18" cy="22" r="5.5" /><circle className="cut" cx="30" cy="22" r="5.5" />
        <circle cx="18" cy="22" r="2.4" /><circle cx="30" cy="22" r="2.4" />
        <path className="cut" d="M22 27.5h4L24 31z" />
        <path className="cut" d="M18 34l2 2 2-2 2 2 2-2 2 2 2-2v1.6l-2 2-2-2-2 2-2-2-2 2-2-2z" />
      </Shape>
    ),
  },
  {
    id: 'rabbit', name: 'Rabbit', art: (
      <Shape>
        <ellipse cx="17" cy="12" rx="4.5" ry="11" transform="rotate(-10 17 12)" />
        <ellipse cx="31" cy="12" rx="4.5" ry="11" transform="rotate(10 31 12)" />
        <ellipse className="cut" cx="17" cy="12" rx="1.8" ry="7" transform="rotate(-10 17 12)" />
        <ellipse className="cut" cx="31" cy="12" rx="1.8" ry="7" transform="rotate(10 31 12)" />
        <circle cx="24" cy="31" r="13" />
        <circle className="cut" cx="19" cy="29" r="1.8" /><circle className="cut" cx="29" cy="29" r="1.8" />
        <path className="cut" d="M22 34h4l-2 2.2z" />
      </Shape>
    ),
  },
];

export const avatarOf = (id?: string) => AVATARS.find((a) => a.id === id);

type Face = Pick<Settings, 'name' | 'avatar' | 'avatarPhoto'>;

/** The profile circle: your photo or the chosen avatar, else initials, else a person icon. */
export function AvatarFace({ s }: { s: Face }) {
  if (s.avatar === 'photo' && s.avatarPhoto) return <img className="avatar-art photo" src={s.avatarPhoto} alt="" />;
  const a = avatarOf(s.avatar);
  if (a) return <>{a.art}</>;
  return <>{s.name ? initials(s.name) : <UserIcon />}</>;
}

export const hasArt = (s: Face) => (s.avatar === 'photo' && !!s.avatarPhoto) || !!avatarOf(s.avatar);
