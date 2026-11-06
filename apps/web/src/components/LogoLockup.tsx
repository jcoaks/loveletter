/** Logo "Love Letter" con el sello de cera (fondo transparente, para fondo vino). */
export function LogoLockup({
  height,
  width,
  className = '',
  priority = false,
}: {
  height?: number;
  /** Ancho CSS (por omisión sale del alto). */
  width?: string;
  className?: string;
  /** Visible al cargar (portada): se pide con prioridad alta. */
  priority?: boolean;
}) {
  return (
    <img
      src="/assets/logo-lockup.webp"
      alt="Love Letter"
      width={560}
      height={125}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      className={className}
      style={{
        height: height ?? (width ? 'auto' : undefined),
        width: width ?? 'auto',
        display: 'block',
      }}
    />
  );
}
