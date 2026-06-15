import { sampleData } from './sampleData';
import type { AppData, Profile } from './types';

const DATA_KEY = 'moar_coworking_demo_data_v1';
const PROFILE_KEY = 'moar_coworking_demo_profile_v1';

export const loadLocalData = (): AppData => {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    localStorage.setItem(DATA_KEY, JSON.stringify(sampleData));
    return sampleData;
  }
  try {
    return JSON.parse(raw) as AppData;
  } catch {
    localStorage.setItem(DATA_KEY, JSON.stringify(sampleData));
    return sampleData;
  }
};

export const saveLocalData = (data: AppData) => {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
};

export const loadLocalProfile = (): Profile | null => {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Profile; } catch { return null; }
};

export const saveLocalProfile = (profile: Profile | null) => {
  if (!profile) localStorage.removeItem(PROFILE_KEY);
  else localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

export const resetLocalDemo = () => {
  localStorage.setItem(DATA_KEY, JSON.stringify(sampleData));
};
