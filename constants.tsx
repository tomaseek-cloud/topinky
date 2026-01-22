
import React from 'react';

export const DEFAULT_ALBUM_URL = "https://photos.app.goo.gl/yoqtdFEe9Us46bB39";

export const ALL_AVATARS = [
  '🦊', '🐺', '🐦', '🦉', '🐻', '🐗', '🐢', '🦅', '🦌', '🐿️', 
  '🦔', '🐰', '🐭', '🐱', '🐶', '🦁', '🐯', '🦒', '🐘', '🦏',
  '🦎', '🐍', '🐸', '🐝', '🐞', '🦋', '🐟', '🐙', '🐋', '🌲',
  '🏔️', '🔥', '💧', '⚡', '🏹', '⛺', '🎒', '🔦', '🗺️', '🛶'
];

export const DiamondIcon = ({ color = "#3b5a3b", className = "w-5 h-5 inline-block" }: { color?: string, className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 2L95 50L50 98L5 50L50 2Z" fill="#1A1A1A"/>
    <path d="M15 50L50 85L85 50L50 55L15 50Z" fill={color} fillOpacity="0.8"/>
    <path d="M50 15L85 50L50 55L15 50L50 15Z" fill={color}/>
    <path d="M50 15L15 50L35 52.5L50 15Z" fill="#FFFFFF" fillOpacity="0.2"/>
    <path d="M50 15L85 50L65 52.5L50 15Z" fill="#000000" fillOpacity="0.1"/>
    <path d="M50 15V55M15 50H85" stroke="#000000" strokeWidth="1" strokeOpacity="0.1"/>
  </svg>
);

export const GreenDiamond = ({ className = "w-5 h-5 inline-block" }: { className?: string }) => (
  <DiamondIcon color="#3b5a3b" className={className} />
);
