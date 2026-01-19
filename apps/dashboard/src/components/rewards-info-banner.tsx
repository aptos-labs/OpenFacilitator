'use client';

import { useAuth } from '@/components/auth/auth-provider';

export function RewardsInfoBanner() {
  const { isAuthenticated, isEnrolled, isFacilitatorOwner } = useAuth();

  // Don't show if not authenticated or already enrolled
  if (!isAuthenticated || isEnrolled) return null;

  return (
    <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-primary">Earn $OPEN Rewards</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isFacilitatorOwner
              ? "Your facilitator volume qualifies for rewards! Address management coming soon."
              : "Track payment volume and earn $OPEN tokens. Address management coming soon."}
          </p>
        </div>
        <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">Coming Soon</span>
      </div>
    </div>
  );
}
