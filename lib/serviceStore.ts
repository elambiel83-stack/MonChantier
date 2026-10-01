import { services as seedServices } from '@/components/monchantier/constants';
import { readStore, withStore } from './storeDb';
import type { PricingStatus } from './partnerPricing';

export type StoredService = {
  id: number;
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
  img: string;
  category: string;
  priceUSD: number | null;
  priceCDF: number | null;
  submittedPriceUSD: number | null;
  submittedPriceCDF: number | null;
  platformFeePercent: number;
  pricingStatus: PricingStatus;
  active: boolean;
  // Absent = service MonChantier (catalogue plateforme). Présent = service
  // apporté par un partenaire (rôle "technician"), identifié par son email.
  ownerIdentity?: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceStoreModel = { services: StoredService[]; nextId: number };

const STORE_KEY = 'service-store';

function buildSeedStore(): ServiceStoreModel {
  const now = new Date().toISOString();
  const seeded: StoredService[] = seedServices.map((s, index) => ({
    id: index + 1,
    icon: s.icon,
    fr: s.fr,
    en: s.en,
    frDesc: s.frDesc,
    enDesc: s.enDesc,
    img: s.img,
    category: s.category,
    priceUSD: null,
    priceCDF: null,
    submittedPriceUSD: null,
    submittedPriceCDF: null,
    platformFeePercent: 0,
    pricingStatus: 'platform',
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
  return { services: seeded, nextId: seeded.length + 1 };
}

export async function listServices(options?: { activeOnly?: boolean }): Promise<StoredService[]> {
  const store = await readStore(STORE_KEY, buildSeedStore);
  return options?.activeOnly ? store.services.filter((s) => s.active) : store.services;
}

export async function getService(id: number): Promise<StoredService | null> {
  const store = await readStore(STORE_KEY, buildSeedStore);
  return store.services.find((s) => s.id === id) || null;
}

export async function listServicesByOwner(ownerIdentity: string): Promise<StoredService[]> {
  const normalized = ownerIdentity.trim().toLowerCase();
  const store = await readStore(STORE_KEY, buildSeedStore);
  return store.services.filter((s) => s.ownerIdentity === normalized);
}

export function createService(input: {
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
  img: string;
  category?: string;
  priceUSD: number | null;
  priceCDF: number | null;
  ownerIdentity?: string;
  submittedPriceUSD?: number | null;
  submittedPriceCDF?: number | null;
  platformFeePercent?: number;
  pricingStatus?: PricingStatus;
  active?: boolean;
}): Promise<StoredService> {
  return withStore(STORE_KEY, buildSeedStore, (store) => {
    const now = new Date().toISOString();
    const service: StoredService = {
      id: store.nextId,
      icon: input.icon,
      fr: input.fr,
      en: input.en,
      frDesc: input.frDesc,
      enDesc: input.enDesc,
      img: input.img,
      category: input.category || 'autres',
      priceUSD: input.priceUSD,
      priceCDF: input.priceCDF,
      submittedPriceUSD: input.submittedPriceUSD ?? input.priceUSD,
      submittedPriceCDF: input.submittedPriceCDF ?? input.priceCDF,
      platformFeePercent: input.platformFeePercent ?? 0,
      pricingStatus: input.pricingStatus ?? (input.ownerIdentity ? 'pending' : 'platform'),
      ownerIdentity: input.ownerIdentity?.trim().toLowerCase(),
      active: input.active ?? !input.ownerIdentity,
      createdAt: now,
      updatedAt: now,
    };
    store.services.push(service);
    store.nextId += 1;
    return service;
  });
}

export type UpdateServicePatch = Partial<
  Pick<StoredService, 'icon' | 'fr' | 'en' | 'frDesc' | 'enDesc' | 'img' | 'category' | 'priceUSD' | 'priceCDF' | 'submittedPriceUSD' | 'submittedPriceCDF' | 'platformFeePercent' | 'pricingStatus' | 'active'>
>;

export function updateService(id: number, patch: UpdateServicePatch): Promise<StoredService | null> {
  return withStore(STORE_KEY, buildSeedStore, (store) => {
    const service = store.services.find((s) => s.id === id);
    if (!service) return null;
    Object.assign(service, patch, { updatedAt: new Date().toISOString() });
    return service;
  });
}

export function deleteService(id: number): Promise<boolean> {
  return withStore(STORE_KEY, buildSeedStore, (store) => {
    const index = store.services.findIndex((s) => s.id === id);
    if (index === -1) return false;
    store.services.splice(index, 1);
    return true;
  });
}
