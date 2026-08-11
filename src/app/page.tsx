// Unreachable in practice — middleware redirects "/" to /login or the
// signed-in user's home page before this ever renders.
export default function RootPage() {
  return null;
}
