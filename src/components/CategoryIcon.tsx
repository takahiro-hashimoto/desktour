"use client";

import {
  Keyboard,
  Mouse,
  Monitor,
  Smartphone,
  Table,
  Armchair,
  Mic,
  Camera,
  Headphones,
  Speaker,
  Lamp,
  Laptop,
  MonitorUp,
  Cable,
  Square,
  Archive,
  Cpu,
  Tablet,
  BatteryCharging,
  AudioLines,
  HardDrive,
  Gamepad2,
  Layers,
  GripVertical,
  Package,
  LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "キーボード": Keyboard,
  "マウス": Mouse,
  "ディスプレイ・モニター": Monitor,
  "モバイルモニター": Smartphone,
  "デスク": Table,
  "チェア": Armchair,
  "マイク": Mic,
  "ウェブカメラ": Camera,
  "ヘッドホン・イヤホン": Headphones,
  "スピーカー": Speaker,
  "照明・ライト": Lamp,
  "PCスタンド・ノートPCスタンド": Laptop,
  "モニターアーム": MonitorUp,
  "マイクアーム": GripVertical,
  "デスクマット": Square,
  "収納・整理": Archive,
  "PC本体": Cpu,
  "タブレット": Tablet,
  "充電器・電源タップ": BatteryCharging,
  "オーディオインターフェース": AudioLines,
  "ドッキングステーション": HardDrive,
  "左手デバイス": Gamepad2,
  "デスクシェルフ・モニター台": Layers,
  "配線整理グッズ": Cable,
  "その他デスクアクセサリー": Package,
};

interface CategoryIconProps {
  category: string;
  className?: string;
  size?: number;
}

export function CategoryIcon({ category, className = "", size = 20 }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[category] || Package;
  return <Icon className={className} size={size} />;
}
