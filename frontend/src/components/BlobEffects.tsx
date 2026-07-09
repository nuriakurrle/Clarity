/**
 * Geteilte Bausteine für den Blob-/Gel-Look (Home-Blob + Kalender-Bubbles).
 *
 * Hier liegt die im Home-Blob erarbeitete, iOS-sichere Technik:
 *  - FadeMask: gemeinsame radiale Ausblend-Maske für ALLE Layer einer Bubble
 *    (Farbe, Grain, Glanz) – Alpha 0 ab 80 %, deutlich vor dem Canvas-Rand.
 *    Verhindert den sichtbaren Kasten, wenn geblurrte Inhalte an der
 *    Svg-Grenze abgeschnitten werden.
 *  - saturate(): Sättigungsboost in JS. Ersatz für FeColorMatrix saturate,
 *    der die gesamte rechteckige Filter-Region verfärbte (Premultiply-Bug
 *    auf iOS) und deshalb nicht verwendet wird.
 *  - lightenToward(): Screen-Blend-Näherung gegen trübe Mischzonen.
 *  - NOISE_TEXTURE: statisches Korn-PNG. FeTurbulence ist in react-native-svg
 *    nicht nativ implementiert und rendert auf iOS nichts.
 */
import React from 'react';
import { Circle, Mask, RadialGradient, Stop } from 'react-native-svg';

/** Statische Korn-Textur (128×128 Graustufen-Rauschen), gekachelt. */
export const NOISE_TEXTURE = require('../../assets/noise.png');

/** Kantenlänge der Grain-Kachel in px. */
export const NOISE_TILE = 128;

/** Radiale Ausblend-Maske; `size` = Kantenlänge des quadratischen Canvas. */
export function FadeMask({ id, size }: { id: string; size: number }) {
  return (
    <>
      <RadialGradient id={`${id}-grad`} cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#fff" stopOpacity={1} />
        <Stop offset="55%" stopColor="#fff" stopOpacity={1} />
        <Stop offset="80%" stopColor="#fff" stopOpacity={0} />
        <Stop offset="100%" stopColor="#fff" stopOpacity={0} />
      </RadialGradient>
      <Mask id={id}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}-grad)`} />
      </Mask>
    </>
  );
}

/** Sättigung einer Hex-Farbe anheben (HSL-Boost). */
export function saturate(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex; // grau – nichts zu sättigen
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  let s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  s = Math.min(1, s * factor);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to255 = (v: number) => Math.round(v * 255);
  return `#${((to255(hue(h + 1 / 3)) << 16) | (to255(hue(h)) << 8) | to255(hue(h - 1 / 3)))
    .toString(16)
    .padStart(6, '0')}`;
}

/** Hex-Farbe anteilig Richtung Weiß mischen (Screen-Blend-Näherung). */
export function lightenToward(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
