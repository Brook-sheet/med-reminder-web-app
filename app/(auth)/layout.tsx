
export default function Formlayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-800">
      <main>{children}</main>
    </div>
  );
}