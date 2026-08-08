import styles from './Skeleton.module.css';

export function Skeleton({ largura = '100%', altura = '16px', className = '', style = {} }) {
  return <div className={`${styles.skeleton} ${className}`} style={{ width: largura, height: altura, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-sm)' }}>
      <Skeleton largura="60%" altura="12px" />
      <Skeleton largura="80%" altura="26px" />
      <Skeleton largura="40%" altura="12px" />
    </div>
  );
}

export function SkeletonLinha() {
  return (
    <div style={{ display: 'flex', gap: 'var(--espaco-md)', alignItems: 'center', padding: '12px 0' }}>
      <Skeleton largura="34px" altura="34px" style={{ borderRadius: '50%', flexShrink: 0 }} />
      <Skeleton largura="70%" altura="14px" />
    </div>
  );
}
