import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useGoesOnTour } from '#/features/parcels/api/use-tour';

/** A shuttle acting as department has no tour: Colis is its work. */
export function OnTourOnly({ children }: { children: ReactNode }) {
  const tour = useGoesOnTour();
  if (tour === undefined) return null;
  return tour ? children : <Navigate to="/" replace />;
}
