import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UniversitySelector({
  value,
  country,
  onChange,
}: {
  value: string | null;
  country: string | null;
  onChange: (next: { universityId: string | null; universityName: string | null; country: string | null }) => void;
}) {
  const [universityName, setUniversityName] = useState(value ?? "");
  const [countryName, setCountryName] = useState(country ?? "");

  useEffect(() => { setUniversityName(value ?? ""); }, [value]);
  useEffect(() => { setCountryName(country ?? ""); }, [country]);

  const emit = (nextUni: string, nextCountry: string) => {
    onChange({
      universityId: null,
      universityName: nextUni.trim() || null,
      country: nextCountry.trim() || null,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Country</Label>
        <Input
          value={countryName}
          placeholder="e.g. Nigeria"
          onChange={(e) => {
            setCountryName(e.target.value);
            emit(universityName, e.target.value);
          }}
        />
      </div>
      <div>
        <Label className="text-xs">University</Label>
        <Input
          value={universityName}
          placeholder="e.g. University of Lagos"
          onChange={(e) => {
            setUniversityName(e.target.value);
            emit(e.target.value, countryName);
          }}
        />
      </div>
    </div>
  );
}
