"use client";

import {
  Keyboard,
  Mouse,
  Monitor,
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
  Package,
  LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "キーボード": Keyboard,
  "マウス": Mouse,
  "ディスプレイ/モニター": Monitor,
  "デスク": Table,
  "チェア": Armchair,
  "マイク": Mic,
  "ウェブカメラ": Camera,
  "ヘッドホン/イヤホン": Headphones,
  "スピーカー": Speaker,
  "照明": Lamp,
  "PCスタンド/ノートPCスタンド": Laptop,
  "モニターアーム": MonitorUp,
  "ケーブル/ハブ": Cable,
  "デスクマット": Square,
  "収納/整理": Archive,
  "PC本体": Cpu,
  "タブレット": Tablet,
  "充電器/電源": BatteryCharging,
  "オーディオインターフェース": AudioLines,
  "ドッキングステーション": HardDrive,
  "左手デバイス": Gamepad2,
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
