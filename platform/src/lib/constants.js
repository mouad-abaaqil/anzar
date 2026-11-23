import { Activity, BookOpen, Handshake, LayoutDashboard, Scale, Map, Satellite, Waves } from 'lucide-react';

export const kinds = {
  dam: 'Barrages',
  desalination: 'Dessalement',
  treatment: 'Épuration',
  groundwater: 'Nappes',
};

export const kindSingular = {
  dam: 'Barrage',
  desalination: 'Station de dessalement',
  treatment: 'Station d’épuration',
  groundwater: 'Ressource souterraine',
};

export const nav = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'balance', label: 'Autosuffisance & scénarios', icon: Scale },
  { id: 'map', label: 'Explorer la carte', icon: Map },
  { id: 'quality', label: 'Qualité de l’eau', icon: Activity },
  { id: 'cycle', label: 'Cycle de l’eau', icon: Waves },
  { id: 'regions', label: 'Régions & collaboration', icon: Handshake },
  { id: 'forecast', label: 'Prévision & satellite', icon: Satellite },
  { id: 'sources', label: 'Sources & méthode', icon: BookOpen },
];
