import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type University = { id: string; name: string; country: string; slug: string };

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function UniversitySelector({
  value,
  country,
  onChange,
}: {
  value: string | null;
  country: string | null;
  onChange: (next: { universityId: string | null; universityName: string | null; country: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<University[]>([]);
  const [selected, setSelected] = useState<University | null>(null);
  const [countryInput, setCountryInput] = useState(country ?? "");
  const [creating, setCreating] = useState(false);

  // Load selected university metadata
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    supabase.from("universities").select("*").eq("id", value).maybeSingle()
      .then(({ data }) => { if (data) setSelected(data as University); });
  }, [value]);

  // Search universities
  useEffect(() => {
    let cancel = false;
    const q = query.trim();
    const run = async () => {
      let req = supabase.from("universities").select("*").order("name").limit(25);
      if (q) req = req.ilike("name", `%${q}%`);
      const { data } = await req;
      if (!cancel) setItems((data ?? []) as University[]);
    };
    run();
    return () => { cancel = true; };
  }, [query, open]);

  useEffect(() => { setCountryInput(country ?? ""); }, [country]);

  const exactMatch = useMemo(() =>
    items.find((u) => u.name.toLowerCase() === query.trim().toLowerCase()),
    [items, query]
  );

  const handleSelect = (u: University) => {
    setSelected(u);
    setOpen(false);
    setCountryInput(u.country);
    onChange({ universityId: u.id, universityName: u.name, country: u.country });
  };

  const handleCreate = async () => {
    const name = query.trim();
    const ctry = countryInput.trim();
    if (!name) return toast.error("Enter a university name");
    if (!ctry) return toast.error("Enter the country first");
    setCreating(true);
    try {
      const slug = slugify(name);
      // Try existing
      const { data: existing } = await supabase
        .from("universities").select("*")
        .eq("slug", slug).eq("country", ctry).maybeSingle();
      let row = existing as University | null;
      if (!row) {
        const { data, error } = await supabase
          .from("universities")
          .insert({ name, country: ctry, slug })
          .select().single();
        if (error) throw error;
        row = data as University;
      }
      handleSelect(row!);
      toast.success(`Added ${row!.name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add university");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Country</Label>
        <Input
          value={countryInput}
          placeholder="e.g. Nigeria"
          onChange={(e) => {
            setCountryInput(e.target.value);
            onChange({
              universityId: selected?.id ?? null,
              universityName: selected?.name ?? null,
              country: e.target.value || null,
            });
          }}
        />
      </div>

      <div>
        <Label className="text-xs">University</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              <span className="truncate">
                {selected ? `${selected.name} · ${selected.country}` : "Select university…"}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Search universities…" value={query} onValueChange={setQuery} />
              <CommandList>
                <CommandEmpty>No results</CommandEmpty>
                <CommandGroup>
                  {items.map((u) => (
                    <CommandItem key={u.id} value={u.id} onSelect={() => handleSelect(u)}>
                      <Check className={cn("mr-2 h-4 w-4", selected?.id === u.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.country}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {query.trim() && !exactMatch && (
                  <div className="border-t p-2">
                    <Button size="sm" className="w-full" disabled={creating} onClick={handleCreate}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Add "{query.trim()}"{countryInput ? ` in ${countryInput}` : ""}
                    </Button>
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
