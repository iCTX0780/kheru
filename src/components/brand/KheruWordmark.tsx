/**
 * The KHERU wordmark (brand v2). Drawn artwork — a capsule with a rule beneath.
 * Single-color stroke bound to `currentColor`, so callers drive the colour:
 * violet on light grounds, white on dark. Never place violet on black (3.83:1).
 * Do not alter proportions, gap, or stroke ratios — see brand/v2/BRAND-SPEC.md.
 */
export function KheruWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 820 296"
      role="img"
      aria-label="Kheru"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Kheru</title>
      <rect x="8" y="8" width="804" height="244" rx="122" ry="122" strokeWidth="16" />
      <g transform="translate(242 130) scale(0.88)" strokeWidth="14.5455">
        <path d="M -28 -50 L -28 50" />
        <path d="M 28 -50 L -22 0 L 28 50" />
      </g>
      <g transform="translate(326 130) scale(0.88)" strokeWidth="14.5455">
        <path d="M -28 -50 L -28 50" />
        <path d="M 28 -50 L 28 50" />
        <path d="M -28 0 L 28 0" />
      </g>
      <g transform="translate(410 130) scale(0.88)" strokeWidth="14.5455">
        <path d="M 28 -50 L -28 -50 L -28 50 L 28 50" />
        <path d="M -28 0 L 16 0" />
      </g>
      <g transform="translate(494 130) scale(0.88)" strokeWidth="14.5455">
        <path d="M -28 -50 L -28 50" />
        <path d="M -28 -50 L 4 -50 A 22 22 0 0 1 4 -6 L -28 -6" />
        <path d="M 2 -6 L 28 50" />
      </g>
      <g transform="translate(578 130) scale(0.88)" strokeWidth="14.5455">
        <path d="M -28 -50 L -28 22 A 28 28 0 0 0 28 22 L 28 -50" />
      </g>
      <path d="M 8 288 L 812 288" strokeWidth="16" />
    </svg>
  )
}
