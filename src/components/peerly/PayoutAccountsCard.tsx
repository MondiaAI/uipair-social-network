import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Star, Smartphone, Landmark, Wallet, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  listMyPayoutAccounts, addPayoutAccount, deletePayoutAccount, setDefaultPayoutAccount,
} from "@/lib/payouts.functions";
import { useAuth } from "@/lib/auth-context";

type Account = {
  id: string; method: "mobile_money" | "bank" | "flutterwave_wallet";
  label: string | null; is_default: boolean;
  mm_country: string | null; mm_provider: string | null; mm_phone: string | null;
  bank_name: string | null; bank_country: string | null; bank_account_number: string | null;
  bank_account_name: string | null; bank_swift: string | null;
  wallet_email: string | null;
};

const MM_PROVIDERS = ["MTN", "Airtel Money", "M-Pesa", "Vodafone Cash", "Orange Money", "Tigo Pesa"];

export function PayoutAccountsCard() {
  const { profile } = useAuth();
  const isPremium = !!profile?.is_pro;
  const list = useServerFn(listMyPayoutAccounts);
  const add = useServerFn(addPayoutAccount);
  const del = useServerFn(deletePayoutAccount);
  const setDefault = useServerFn(setDefaultPayoutAccount);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const res: any = await list();
    setAccounts((res?.accounts ?? []) as Account[]);
    setLoading(false);
  };

  useEffect(() => { if (profile) refresh(); /* eslint-disable-next-line */ }, [profile?.id]);

  if (!profile) return null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Payout accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            Where you'll receive earnings from your Premium gigs, tutoring, and resources.
          </p>
        </div>
        <Button size="sm" onClick={() => isPremium ? setOpen(true) : toast.info("Upgrade to Premium to add payout accounts.")}
          className="gap-1">
          {isPremium ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          Add
        </Button>
      </div>

      {!isPremium ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Payout collection is a Premium feature. Upgrade to start earning on UiPair.
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payout accounts yet. Add one to get paid.</p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {a.method === "mobile_money" && <Smartphone className="h-4 w-4 text-emerald-600" />}
                  {a.method === "bank" && <Landmark className="h-4 w-4 text-blue-600" />}
                  {a.method === "flutterwave_wallet" && <Wallet className="h-4 w-4 text-purple-600" />}
                  <span className="font-medium">{a.label || labelFor(a)}</span>
                  {a.is_default && <Badge variant="secondary" className="gap-1 text-[10px]"><Star className="h-3 w-3" /> Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{detailLine(a)}</p>
              </div>
              <div className="flex items-center gap-1">
                {!a.is_default && (
                  <Button variant="ghost" size="sm" onClick={async () => {
                    const r: any = await setDefault({ data: { id: a.id } });
                    if (r?.error) return toast.error(r.error);
                    toast.success("Default updated");
                    refresh();
                  }}>Set default</Button>
                )}
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!confirm("Delete this payout account?")) return;
                  const r: any = await del({ data: { id: a.id } });
                  if (r?.error) return toast.error(r.error);
                  refresh();
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddPayoutDialog open={open} onOpenChange={setOpen} onAdded={() => { setOpen(false); refresh(); }} addFn={add} />
    </Card>
  );
}

function labelFor(a: Account) {
  if (a.method === "mobile_money") return `${a.mm_provider} Mobile Money`;
  if (a.method === "bank") return `${a.bank_name}`;
  return "Flutterwave Wallet";
}
function detailLine(a: Account) {
  if (a.method === "mobile_money") return `${a.mm_phone} · ${a.mm_country}`;
  if (a.method === "bank") return `${a.bank_account_name} · ${a.bank_account_number} · ${a.bank_country}`;
  return a.wallet_email ?? "";
}

function AddPayoutDialog({ open, onOpenChange, onAdded, addFn }: {
  open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void; addFn: any;
}) {
  const [method, setMethod] = useState<"mobile_money" | "bank" | "flutterwave_wallet">("mobile_money");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  // mm
  const [mmCountry, setMmCountry] = useState("");
  const [mmProvider, setMmProvider] = useState("MTN");
  const [mmPhone, setMmPhone] = useState("");
  // bank
  const [bankName, setBankName] = useState("");
  const [bankCountry, setBankCountry] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  // wallet
  const [walletEmail, setWalletEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const payload: any = { method, label: label || null, is_default: isDefault };
    if (method === "mobile_money") Object.assign(payload, { mm_country: mmCountry, mm_provider: mmProvider, mm_phone: mmPhone });
    if (method === "bank") Object.assign(payload, { bank_name: bankName, bank_country: bankCountry, bank_account_number: bankAccountNumber, bank_account_name: bankAccountName, bank_swift: bankSwift || null });
    if (method === "flutterwave_wallet") Object.assign(payload, { wallet_email: walletEmail });
    try {
      const r: any = await addFn({ data: payload });
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Payout account added");
      onAdded();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add account");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add payout account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile_money">Mobile Money (MTN, M-Pesa, Airtel…)</SelectItem>
                <SelectItem value="bank">Bank account</SelectItem>
                <SelectItem value="flutterwave_wallet">Flutterwave Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="label">Nickname (optional)</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My main payout" />
          </div>

          {method === "mobile_money" && (
            <div className="space-y-3">
              <div>
                <Label>Provider</Label>
                <Select value={mmProvider} onValueChange={setMmProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MM_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Country</Label><Input value={mmCountry} onChange={(e) => setMmCountry(e.target.value)} placeholder="Kenya" /></div>
              <div><Label>Phone number</Label><Input value={mmPhone} onChange={(e) => setMmPhone(e.target.value)} placeholder="+2547XXXXXXXX" /></div>
            </div>
          )}

          {method === "bank" && (
            <div className="space-y-3">
              <div><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
              <div><Label>Country</Label><Input value={bankCountry} onChange={(e) => setBankCountry(e.target.value)} /></div>
              <div><Label>Account number</Label><Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} /></div>
              <div><Label>Account holder name</Label><Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} /></div>
              <div><Label>SWIFT/BIC (optional)</Label><Input value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} /></div>
            </div>
          )}

          {method === "flutterwave_wallet" && (
            <div><Label>Wallet email</Label><Input type="email" value={walletEmail} onChange={(e) => setWalletEmail(e.target.value)} placeholder="you@example.com" /></div>
          )}

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Set as default
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Add account"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
