import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

// Réplique de assets/brand/logo-mark-color.svg (pas de transformer SVG dans metro).
// Couleurs de marque fixes, indépendantes du thème.
const BRAND_EMERALD_DEEP = '#0E9E62';
const BRAND_EMERALD_BRIGHT = '#17E58A';
const BRAND_INK = '#0A0A0F';

const EDGE_SPOT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function LogoMark({ size = 88 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="upkEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={BRAND_EMERALD_DEEP} />
          <Stop offset="100%" stopColor={BRAND_EMERALD_BRIGHT} />
        </LinearGradient>
      </Defs>
      <Circle cx="100" cy="100" r="58" fill="url(#upkEmeraldGrad)" />
      <G fill={BRAND_INK}>
        {EDGE_SPOT_ANGLES.map((angle) => (
          <Rect
            key={angle}
            x="-5"
            y="-56"
            width="10"
            height="16"
            rx="3"
            transform={`translate(100,100) rotate(${angle})`}
          />
        ))}
      </G>
      <Circle cx="100" cy="100" r="42" fill={BRAND_INK} />
      <Circle cx="100" cy="100" r="34" fill="none" stroke="url(#upkEmeraldGrad)" strokeWidth="4" />
    </Svg>
  );
}
