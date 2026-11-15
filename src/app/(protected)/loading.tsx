export default function ProtectedLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat halaman">
      <div className="h-20 rounded-3xl bg-white/75 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 h-72 rounded-[26px] bg-white/75 animate-pulse" />
        <div className="lg:col-span-8 h-72 rounded-[26px] bg-white/75 animate-pulse" />
      </div>
    </div>
  );
}
