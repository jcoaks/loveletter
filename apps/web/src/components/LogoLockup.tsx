/** Logo "Love Letter" con el sello de cera (fondo transparente, para fondo vino). */
export function LogoLockup({ height, className = '' }: { height?: number; className?: string }) {
  return (
    <img
      src="/assets/logo-lockup.webp"
      alt="Love Letter"
      width={560}
      height={125}
      decoding="async"
      className={className}
      style={{ height: height ?? undefined, width: 'auto', display: 'block' }}
    />
  );
}
