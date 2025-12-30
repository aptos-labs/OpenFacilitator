'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ExternalLink,
  Settings,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Wallet,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, type Facilitator } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import { Navbar } from '@/components/navbar';
import { useToast } from '@/hooks/use-toast';
import { useDomainStatus } from '@/hooks/use-domain-status';
import { SubscriptionConfirmDialog } from '@/components/subscription-confirm-dialog';
import { SubscriptionSuccessDialog } from '@/components/subscription-success-dialog';

const FREE_ENDPOINT = 'https://x402.openfacilitator.io';

// Status indicator component
function StatusIndicator({ status }: { status: 'active' | 'pending' | 'not_ready' | 'checking' }) {
  const config = {
    active: { color: 'bg-primary', ping: true, title: 'Active' },
    pending: { color: 'bg-yellow-500', ping: true, title: 'DNS Propagating' },
    not_ready: { color: 'bg-red-500', ping: false, title: 'Not Ready' },
    checking: { color: 'bg-muted-foreground', ping: false, title: 'Checking...' },
  };

  const { color, ping, title } = config[status];

  return (
    <span className="relative flex h-2 w-2" title={title}>
      {ping && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

// Section 1: Your Facilitator - Has Facilitator State
function FacilitatorHero({
  facilitator,
  onDnsSetupClick,
}: {
  facilitator: Facilitator;
  onDnsSetupClick: () => void;
}) {
  const router = useRouter();
  const { isActive, isPending, isNotConfigured, isLoading: isDomainLoading } = useDomainStatus(
    facilitator.id,
    !!facilitator.customDomain
  );

  const hasCustomDomain = !!facilitator.customDomain;
  const isNotReady = hasCustomDomain && (isNotConfigured || isDomainLoading);

  const getStatus = () => {
    if (!hasCustomDomain) return 'not_ready';
    if (isActive) return 'active';
    if (isPending) return 'pending';
    if (isNotReady) return 'not_ready';
    return 'checking';
  };

  const displayDomain = facilitator.customDomain || facilitator.subdomain;
  const displayUrl = facilitator.url;

  // If DNS is not ready, show DNS dialog instead of navigating to manage page
  const handleManageClick = () => {
    if (isActive) {
      router.push(`/dashboard/${facilitator.id}`);
    } else {
      onDnsSetupClick();
    }
  };

  return (
    <div className="text-center">
      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
        Your <span className="text-primary">x402</span> Facilitator
      </h1>
      <div className="flex items-center justify-center gap-2 mb-10">
        <StatusIndicator status={getStatus()} />
        <span className="text-muted-foreground">
          {getStatus() === 'active' ? 'Active' : getStatus() === 'pending' ? 'DNS Propagating' : getStatus() === 'not_ready' ? 'Setup Required' : 'Checking'}
        </span>
      </div>

      {/* Domain Display - The Hero */}
      <div className="inline-block px-10 py-6 rounded-2xl bg-muted/40 border border-border/50 mb-8">
        <p className="text-3xl sm:text-4xl font-mono font-semibold text-foreground">
          {displayDomain}
        </p>
        <p className="text-sm text-muted-foreground mt-2 font-mono">
          {displayUrl}
        </p>
      </div>

      {/* Status Alerts */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 mb-8 px-4 py-3 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-sm max-w-md mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>DNS propagating - your domain may not work yet</span>
        </div>
      )}
      {isNotReady && hasCustomDomain && (
        <div className="flex items-center justify-center gap-2 mb-8 px-4 py-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-500 text-sm max-w-md mx-auto">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>DNS setup required - complete setup to activate</span>
        </div>
      )}
      {!hasCustomDomain && (
        <div className="flex items-center justify-center gap-2 mb-8 px-4 py-3 rounded-lg bg-muted/50 text-muted-foreground text-sm max-w-md mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>No custom domain configured</span>
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground mb-10">
        <div>
          <span>Networks:</span>
          <span className="ml-1 font-medium text-foreground">
            {facilitator.supportedChains.length} chain{facilitator.supportedChains.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div>
          <span>Created:</span>
          <span className="ml-1 font-medium text-foreground">{formatDate(facilitator.createdAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <Button size="lg" onClick={handleManageClick}>
          <Settings className="w-4 h-4 mr-2" />
          {isActive ? 'Manage' : 'Complete Setup'}
        </Button>
        {isActive && (
          <Button size="lg" variant="outline" asChild>
            <a href={displayUrl} target="_blank" rel="noopener noreferrer">
              View
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

// Section 1: Your Facilitator - Empty State
function EmptyFacilitatorHero({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center">
      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
        Your <span className="text-primary">x402</span> Facilitator
      </h1>
      <p className="text-xl text-muted-foreground mb-10">
        Your custom payment endpoint
      </p>

      {/* Domain Placeholder - The Feature */}
      <div className="inline-block px-10 py-6 rounded-2xl bg-muted/40 border border-border/50 mb-10">
        <p className="text-3xl sm:text-4xl font-mono font-semibold text-muted-foreground">
          pay.yourdomain.com
        </p>
      </div>

      {/* CTA */}
      <div>
        <Button size="lg" className="px-8" onClick={onCreateClick}>
          <Plus className="w-5 h-5 mr-2" />
          Create Facilitator
        </Button>
      </div>
    </div>
  );
}

// Section 2: Free Alternative
function FreeEndpointSection() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(FREE_ENDPOINT);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Free endpoint URL copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-border/60 bg-muted/10 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">Or just use ours</p>
          <div className="flex items-center gap-3">
            <code className="text-sm font-mono text-foreground">
              {FREE_ENDPOINT}
            </code>
            <span className="text-xs text-muted-foreground">No setup needed</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy URL
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Section 3: Plan Card
function PlanCard({
  subscription,
  isPurchasing,
  onSubscribeClick
}: {
  subscription: { active: boolean; tier: string | null; expires: string | null } | undefined;
  isPurchasing: boolean;
  onSubscribeClick: () => void;
}) {
  return (
    <Card className="border-border/60 bg-muted/10 shadow-none">
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Plan</p>
        <div className="flex items-center gap-2 mb-3">
          {subscription?.active ? (
            <>
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-xl font-semibold">Starter</span>
            </>
          ) : (
            <span className="text-xl font-semibold">Free</span>
          )}
        </div>

        {subscription?.active ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Expires {subscription.expires ? formatDate(subscription.expires) : 'N/A'}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onSubscribeClick}
              disabled={isPurchasing}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Renewing...
                </>
              ) : (
                'Renew $5'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Subscribe to create your own facilitator
            </p>
            <Button
              size="sm"
              onClick={onSubscribeClick}
              disabled={isPurchasing}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Subscribe $5/mo'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Section 3: Wallet Card
function WalletCard({ billingWallet }: { billingWallet: { hasWallet: boolean; balance: string } | undefined }) {
  return (
    <Card className="border-border/60 bg-muted/10 shadow-none">
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Billing Wallet</p>
        <p className="text-xl font-semibold mb-3">
          ${billingWallet?.hasWallet ? billingWallet.balance : '0.00'}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="w-3 h-3" />
            <span>USDC on Solana</span>
          </div>
          <Link
            href="/dashboard/account"
            className="text-xs text-primary hover:underline"
          >
            Manage
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// DNS Setup Dialog
function DnsSetupDialog({
  open,
  onOpenChange,
  facilitator,
  onDnsVerified,
  onFacilitatorUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilitator: Facilitator | null;
  onDnsVerified?: () => void;
  onFacilitatorUpdated?: (facilitator: Facilitator) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const domain = facilitator?.customDomain || '';
  const subdomain = domain.split('.')[0] || 'x402';

  // Fetch domain status to get dynamic DNS records
  const { cnameValue, cnameName: apiCnameName, cnameType } = useDomainStatus(
    facilitator?.id,
    !!facilitator?.customDomain && open
  );
  const cnameName = apiCnameName || subdomain;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cnameValue);
    setCopied(true);
    toast({ title: 'Copied!', description: 'CNAME value copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckDns = async () => {
    if (!facilitator) return;

    setIsChecking(true);
    try {
      const status = await api.getDomainStatus(facilitator.id);
      queryClient.invalidateQueries({ queryKey: ['domainStatus', facilitator.id] });
      queryClient.invalidateQueries({ queryKey: ['facilitators'] });

      if (status.status === 'active') {
        toast({ title: 'DNS Verified!', description: 'Your domain is now active.' });
        onOpenChange(false);
        onDnsVerified?.();
      } else if (status.status === 'pending') {
        toast({
          title: 'DNS Propagating',
          description: 'Your DNS is configured but still propagating. This can take up to 48 hours.',
        });
      } else {
        toast({
          title: 'DNS Not Configured',
          description: 'Please add the CNAME record and try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Check Failed',
        description: 'Could not verify DNS status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const updateDomainMutation = useMutation({
    mutationFn: async (newDomain: string) => {
      if (!facilitator) throw new Error('No facilitator');

      // 1. Remove old domain from Railway if one exists
      if (facilitator.customDomain) {
        try {
          await api.removeDomain(facilitator.id);
        } catch {
          // Continue even if removal fails - domain might not be set up yet
        }
      }

      // 2. Update facilitator with new domain
      const updated = await api.updateFacilitator(facilitator.id, { customDomain: newDomain });

      // 3. Set up new domain on Railway
      await api.setupDomain(facilitator.id);

      return updated;
    },
    onSuccess: (updatedFacilitator) => {
      queryClient.invalidateQueries({ queryKey: ['facilitators'] });
      queryClient.invalidateQueries({ queryKey: ['domainStatus', facilitator?.id] });
      toast({ title: 'Domain updated', description: 'Your domain has been changed. Update your DNS records.' });
      setIsEditing(false);
      onFacilitatorUpdated?.(updatedFacilitator);
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Could not update domain. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleStartEdit = () => {
    setEditValue(domain);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === domain) {
      setIsEditing(false);
      return;
    }
    updateDomainMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Almost there!</DialogTitle>
          <DialogDescription className="text-base">
            Add this DNS record to activate your domain
          </DialogDescription>
        </DialogHeader>

        {/* Domain - Inline Editable */}
        <div className="flex items-center gap-2 py-4">
          {isEditing ? (
            <>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                onKeyDown={handleKeyDown}
                className="font-mono flex-1"
                autoFocus
              />
              <Button
                className="w-20"
                onClick={handleSave}
                disabled={updateDomainMutation.isPending}
              >
                {updateDomainMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm">
                {domain}
              </div>
              <Button className="w-20" variant="outline" onClick={handleStartEdit}>
                Edit
              </Button>
            </>
          )}
        </div>

        {/* DNS Record Box */}
        <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-mono font-medium">{cnameType}</span>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-mono font-medium">{cnameName}</span>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">Value:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium truncate">{cnameValue}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-muted rounded transition-colors shrink-0"
                title="Copy value"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckDns}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Check DNS Status
              </>
            )}
          </Button>

          <div className="text-center">
            <Link
              href="/docs/dns-setup"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Need help? View DNS setup guide
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Create Facilitator Dialog
function CreateFacilitatorDialog({
  open,
  onOpenChange,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (facilitator: Facilitator) => void;
}) {
  const [newFacilitator, setNewFacilitator] = useState({
    name: '',
    customDomain: '',
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; customDomain: string }) => {
      // 1. Create the facilitator
      const facilitator = await api.createFacilitator({
        ...data,
        subdomain: data.customDomain.replace(/\./g, '-'),
      });

      // 2. Set up the domain on Railway
      await api.setupDomain(facilitator.id);

      return facilitator;
    },
    onSuccess: (facilitator) => {
      onSuccess(facilitator);
      onOpenChange(false);
      setNewFacilitator({ name: '', customDomain: '' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Facilitator</DialogTitle>
          <DialogDescription>
            Set up your x402 payment facilitator with your own domain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Facilitator"
              value={newFacilitator.name}
              onChange={(e) =>
                setNewFacilitator((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDomain">Your Domain</Label>
            <Input
              id="customDomain"
              placeholder="pay.yourdomain.com"
              value={newFacilitator.customDomain}
              onChange={(e) =>
                setNewFacilitator((prev) => ({
                  ...prev,
                  customDomain: e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''),
                }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              createMutation.mutate({
                name: newFacilitator.name,
                customDomain: newFacilitator.customDomain,
              });
            }}
            disabled={
              !newFacilitator.name ||
              !newFacilitator.customDomain ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successTxHash, setSuccessTxHash] = useState<string | undefined>();
  const [dnsSetupOpen, setDnsSetupOpen] = useState(false);
  const [dnsSetupFacilitator, setDnsSetupFacilitator] = useState<Facilitator | null>(null);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [authLoading, isAuthenticated, router]);

  const { data: facilitators, isLoading } = useQuery({
    queryKey: ['facilitators'],
    queryFn: () => api.getFacilitators(),
    enabled: isAuthenticated,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscriptionStatus(),
    enabled: isAuthenticated,
  });

  const { data: billingWallet } = useQuery({
    queryKey: ['billingWallet'],
    queryFn: () => api.getBillingWallet(),
    enabled: isAuthenticated,
  });

  const purchaseMutation = useMutation({
    mutationFn: () => api.purchaseSubscription(),
    onSuccess: (result) => {
      if (result.success) {
        setSuccessTxHash(result.txHash);
        setSuccessDialogOpen(true);
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['billingWallet'] });
      } else if (result.insufficientBalance) {
        toast({
          title: 'Insufficient balance',
          description: `You need $${result.required} USDC but only have $${result.available}. Fund your billing wallet first.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Purchase failed',
          description: result.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
      setIsPurchasing(false);
    },
    onError: (error) => {
      toast({
        title: 'Purchase failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
      setIsPurchasing(false);
    },
  });

  const handleSubscribeClick = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirmPurchase = () => {
    setIsPurchasing(true);
    purchaseMutation.mutate();
  };

  const handleCreateSuccess = (facilitator: Facilitator) => {
    queryClient.invalidateQueries({ queryKey: ['facilitators'] });
    // Show DNS setup dialog immediately after creation
    setDnsSetupFacilitator(facilitator);
    setDnsSetupOpen(true);
  };

  const handleDnsSetupClick = (facilitator: Facilitator) => {
    setDnsSetupFacilitator(facilitator);
    setDnsSetupOpen(true);
  };

  const handleDnsVerified = () => {
    if (dnsSetupFacilitator) {
      router.push(`/dashboard/${dnsSetupFacilitator.id}`);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const hasFacilitator = facilitators && facilitators.length > 0;
  const canCreateFacilitator = subscription?.active;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        {/* Section 1: Your Facilitator (Primary CTA) - Hero, no card */}
        <section className="mb-16">
          {isLoading ? (
            <div className="text-center animate-pulse">
              <div className="h-12 bg-muted rounded w-64 mx-auto mb-4" />
              <div className="h-6 bg-muted rounded w-48 mx-auto mb-10" />
              <div className="h-24 bg-muted rounded-2xl w-80 mx-auto mb-10" />
              <div className="h-12 bg-muted rounded w-48 mx-auto" />
            </div>
          ) : hasFacilitator ? (
            <FacilitatorHero
              facilitator={facilitators[0]}
              onDnsSetupClick={() => handleDnsSetupClick(facilitators[0])}
            />
          ) : canCreateFacilitator ? (
            <EmptyFacilitatorHero onCreateClick={() => setIsCreateOpen(true)} />
          ) : (
            // User not subscribed - show subscription prompt (no card, just content)
            <div className="text-center">
              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                Your <span className="text-primary">x402</span> Facilitator
              </h1>
              <p className="text-xl text-muted-foreground mb-10">
                Your custom payment endpoint
              </p>

              {/* Domain Placeholder - The Feature */}
              <div className="inline-block px-10 py-6 rounded-2xl bg-muted/40 border border-border/50 mb-8">
                <p className="text-3xl sm:text-4xl font-mono font-semibold text-muted-foreground">
                  pay.yourdomain.com
                </p>
              </div>

              {/* Subscribe prompt */}
              <p className="text-muted-foreground mb-10">
                Subscribe to the Starter plan to create your own facilitator
              </p>

              {/* CTA */}
              <div>
                <Button size="lg" className="px-8" onClick={handleSubscribeClick} disabled={isPurchasing}>
                  {isPurchasing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Subscribe $5/mo
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Free Alternative (Secondary) */}
        <section className="mb-12">
          <FreeEndpointSection />
        </section>

        {/* Section 3: Account Context (Footer-level) */}
        <section className="grid sm:grid-cols-2 gap-4 mb-10">
          <PlanCard
            subscription={subscription}
            isPurchasing={isPurchasing}
            onSubscribeClick={handleSubscribeClick}
          />
          <WalletCard billingWallet={billingWallet} />
        </section>

        {/* Docs Link */}
        <div className="text-center">
          <Link
            href="/docs"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View Documentation →
          </Link>
        </div>
      </main>

      {/* Create Facilitator Dialog */}
      <CreateFacilitatorDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Subscription Confirmation Dialog */}
      <SubscriptionConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        tier="starter"
        balance={billingWallet?.balance ?? null}
        isPurchasing={isPurchasing}
        onConfirm={handleConfirmPurchase}
      />

      {/* Subscription Success Dialog */}
      <SubscriptionSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        tier="starter"
        txHash={successTxHash}
      />

      {/* DNS Setup Dialog */}
      <DnsSetupDialog
        open={dnsSetupOpen}
        onOpenChange={setDnsSetupOpen}
        facilitator={dnsSetupFacilitator}
        onDnsVerified={handleDnsVerified}
        onFacilitatorUpdated={setDnsSetupFacilitator}
      />
    </div>
  );
}
