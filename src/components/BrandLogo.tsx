import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  variant: 'icon' | 'horizontal' | 'vertical';
  surface?: 'auto' | 'light' | 'dark';
  className?: string;
  decorative?: boolean;
}

const FONT_DISPLAY_STACK =
  "'Inter', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";
const FONT_ZH_STACK =
  "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";
const FONT_EN_STACK = "'Inter', 'Helvetica Neue', Arial, sans-serif";

function EmblemDefs({ prefix }: Readonly<{ prefix: string }>) {
  return (
    <defs>
      <linearGradient id={`${prefix}-blade`} x1="15%" y1="10%" x2="88%" y2="90%">
        <stop offset="0%" stopColor="#007CEB" />
        <stop offset="52%" stopColor="#006AC6" />
        <stop offset="100%" stopColor="#004A94" />
      </linearGradient>
      <linearGradient id={`${prefix}-swoosh-main`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#006AC6" />
        <stop offset="100%" stopColor="#2AD2C9" />
      </linearGradient>
      <linearGradient id={`${prefix}-swoosh-top`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#006AC6" />
        <stop offset="100%" stopColor="#2AD2C9" />
      </linearGradient>
      <radialGradient id={`${prefix}-ball`} cx="34%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#8CF7F0" />
        <stop offset="55%" stopColor="#2AD2C9" />
        <stop offset="100%" stopColor="#009E96" />
      </radialGradient>
      <clipPath id={`${prefix}-blade-clip`}>
        <path d="M 0 -86 C 40 -86 68 -57 68 -17 C 68 15 48 42 24 52 C 15 56 13 64 14 74 L 18 109 C 18 114 14 117 9 117 L -9 117 C -14 117 -18 114 -18 109 L -14 74 C -13 64 -15 56 -24 52 C -48 42 -68 15 -68 -17 C -68 -57 -40 -86 0 -86 Z" />
      </clipPath>
      <linearGradient id={`${prefix}-rule`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#006AC6" />
        <stop offset="100%" stopColor="#2AD2C9" />
      </linearGradient>
    </defs>
  );
}

function EmblemPaths({ prefix }: Readonly<{ prefix: string }>) {
  return (
    <>
      <path
        d="M 44 96 C 46 52 79 21 124 20 L 124 26.5 C 85 28.5 55 56 44 96 Z"
        fill={`url(#${prefix}-swoosh-top)`}
      />

      <g transform="translate(116, 114) rotate(34)">
        <path
          d="M 0 -86 C 40 -86 68 -57 68 -17 C 68 15 48 42 24 52 C 15 56 13 64 14 74 L 18 109 C 18 114 14 117 9 117 L -9 117 C -14 117 -18 114 -18 109 L -14 74 C -13 64 -15 56 -24 52 C -48 42 -68 15 -68 -17 C -68 -57 -40 -86 0 -86 Z"
          fill="#0B3468"
        />
        <g clipPath={`url(#${prefix}-blade-clip)`}>
          <rect x="-78" y="-92" width="156" height="138" fill={`url(#${prefix}-blade)`} />
          <path d="M -78 -92 L 18 -92 L -36 46 L -78 46 Z" fill="#FFFFFF" opacity="0.09" />
          <rect x="-78" y="42" width="156" height="4.5" fill="#2AD2C9" />
          <path d="M -3.5 54 L 3.5 54 L 5 117 L -5 117 Z" fill="#2AD2C9" opacity="0.92" />
        </g>
      </g>

      <g transform="translate(124, 100) skewX(-9)">
        <path d="M -43 -15 H 0 V -2 H -14.5 V 35 H -28.5 V -2 H -43 Z" fill="#FFFFFF" />
        <path d="M -4 -35 H 39 V -22 H 24.5 V 15 H 10.5 V -22 H -4 Z" fill="#2AD2C9" />
        <g fill="#D8FAF7">
          <rect x="-4" y="22.5" width="38" height="3.6" rx="1" />
          <rect x="-2" y="28" width="3.2" height="7" rx="0.8" opacity="0.88" />
          <rect x="6.5" y="28" width="3.2" height="7" rx="0.8" opacity="0.88" />
          <rect x="15" y="28" width="3.2" height="7" rx="0.8" opacity="0.88" />
          <rect x="23.5" y="28" width="3.2" height="7" rx="0.8" opacity="0.88" />
          <rect x="30.8" y="28" width="3.2" height="7" rx="0.8" opacity="0.88" />
        </g>
      </g>

      <path
        d="M 169 170 C 198 150 211 112 204 68 L 195 70 C 200 109 190 144 169 170 Z"
        fill={`url(#${prefix}-swoosh-main)`}
      />

      <g>
        <circle cx="197" cy="45" r="15.5" fill={`url(#${prefix}-ball)`} />
        <path
          d="M 189 41 C 190.5 36.2 195.2 33.8 199.8 34.8 C 196.2 35.8 192.6 38.6 191.2 42.6 Z"
          fill="#FFFFFF"
          opacity="0.88"
        />
      </g>
    </>
  );
}

export function BrandLogo({
  variant,
  surface = 'auto',
  className,
  decorative = false,
}: Readonly<BrandLogoProps>) {
  const rawId = useId();
  const prefix = `tt-brand-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const ttTextClass =
    surface === 'dark'
      ? 'fill-[#38BDF8]'
      : surface === 'light'
        ? 'fill-[#006AC6]'
        : 'fill-[#006AC6] dark:fill-[#38BDF8]';

  const zhBrandClass =
    surface === 'dark'
      ? 'fill-[#F8FAFC]'
      : surface === 'light'
        ? 'fill-[#0B2E59]'
        : 'fill-[#0B2E59] dark:fill-[#F8FAFC]';

  const clubZhClass =
    surface === 'dark'
      ? 'fill-[#CBD5E1]'
      : surface === 'light'
        ? 'fill-[#335070]'
        : 'fill-[#335070] dark:fill-[#CBD5E1]';

  const clubEnClass =
    surface === 'dark'
      ? 'fill-[#2AD2C9]'
      : surface === 'light'
        ? 'fill-[#00968E]'
        : 'fill-[#00968E] dark:fill-[#2AD2C9]';

  const a11yProps = decorative
    ? { 'aria-hidden': true as const }
    : {
        role: 'img' as const,
        'aria-label':
          variant === 'icon'
            ? 'TT戰網 經濟部國際貿易署桌球社 圖標'
            : variant === 'horizontal'
              ? 'TT戰網｜經濟部國際貿易署桌球社'
              : 'TT戰網｜經濟部國際貿易署桌球社 徽章',
      };

  if (variant === 'icon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 240 240"
        className={cn('select-none shrink-0', className)}
        {...a11yProps}
      >
        <EmblemDefs prefix={prefix} />
        <EmblemPaths prefix={prefix} />
      </svg>
    );
  }

  if (variant === 'horizontal') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 560 200"
        className={cn('select-none shrink-0', className)}
        {...a11yProps}
      >
        <EmblemDefs prefix={prefix} />
        <g transform="translate(8, 8) scale(0.7667)">
          <EmblemPaths prefix={prefix} />
        </g>

        <rect x="206" y="40" width="2.5" height="120" rx="1.25" fill="#2AD2C9" opacity="0.45" />

        <g transform="translate(230, 0)">
          <text
            x="0"
            y="96"
            fontFamily={FONT_DISPLAY_STACK}
            fontSize="68"
            fontWeight="900"
            letterSpacing="2"
          >
            <tspan className={ttTextClass} fontStyle="italic">
              TT
            </tspan>
            <tspan className={zhBrandClass} dx="8">
              戰網
            </tspan>
          </text>

          <polygon points="2,112 318,112 311,117.5 0,117.5" fill={`url(#${prefix}-rule)`} />

          <text
            x="2"
            y="144"
            className={clubZhClass}
            fontFamily={FONT_ZH_STACK}
            fontSize="20"
            fontWeight="700"
            letterSpacing="3.5"
          >
            經濟部國際貿易署桌球社
          </text>

          <text
            x="2"
            y="167"
            className={clubEnClass}
            fontFamily={FONT_EN_STACK}
            fontSize="12.5"
            fontWeight="800"
            letterSpacing="3.1"
          >
            TITA TABLE TENNIS CLUB
          </text>
        </g>
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 360"
      className={cn('select-none shrink-0', className)}
      {...a11yProps}
    >
      <EmblemDefs prefix={prefix} />
      <g transform="translate(84, 14) scale(0.8)">
        <EmblemPaths prefix={prefix} />
      </g>

      <g textAnchor="middle">
        <text
          x="180"
          y="262"
          fontFamily={FONT_DISPLAY_STACK}
          fontSize="50"
          fontWeight="900"
          letterSpacing="2"
        >
          <tspan className={ttTextClass} fontStyle="italic">
            TT
          </tspan>
          <tspan className={zhBrandClass} dx="6">
            戰網
          </tspan>
        </text>

        <polygon points="74,276 289,276 284,281 69,281" fill={`url(#${prefix}-rule)`} />

        <text
          x="180"
          y="308"
          className={clubZhClass}
          fontFamily={FONT_ZH_STACK}
          fontSize="16.5"
          fontWeight="700"
          letterSpacing="3"
        >
          經濟部國際貿易署桌球社
        </text>

        <text
          x="180"
          y="330"
          className={clubEnClass}
          fontFamily={FONT_EN_STACK}
          fontSize="11"
          fontWeight="800"
          letterSpacing="2.8"
        >
          TITA TABLE TENNIS CLUB
        </text>
      </g>
    </svg>
  );
}
