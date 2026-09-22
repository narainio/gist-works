export function GistLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" data-testid="img-gist-logo">
      <rect x="0" y="0" width="5" height="52" rx="2.5" fill="var(--gist-accent)" />
      <rect x="9" y="2" width="43" height="12" rx="3" fill="var(--gist-border)" />
      <rect x="9" y="20" width="35" height="12" rx="3" fill="var(--gist-border)" />
      <rect x="9" y="38" width="27" height="12" rx="3" fill="var(--gist-border)" />
    </svg>
  );
}
