/** Re-mounts on every navigation, so each page rises into place instead of cutting in. Reduced motion gets a cross-fade. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter space-y-8">{children}</div>;
}
