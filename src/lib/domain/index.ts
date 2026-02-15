import { desktourConfig } from "./configs/desktour";
import { cameraConfig } from "./configs/camera";
import type { DomainId, DomainConfig } from "./types";

const DOMAIN_CONFIGS: Record<DomainId, DomainConfig> = {
  desktour: desktourConfig,
  camera: cameraConfig,
};

export function getDomainConfig(domain: DomainId): DomainConfig {
  const config = DOMAIN_CONFIGS[domain];
  if (!config) throw new Error(`Unknown domain: ${domain}`);
  return config;
}

export function getAllDomains(): DomainId[] {
  return Object.keys(DOMAIN_CONFIGS) as DomainId[];
}

export type { DomainId, DomainConfig, DomainTableNames, DomainConstants, DomainSearchExtensions } from "./types";
