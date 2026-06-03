import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocationSuggestions } from "@/hooks/use-location-suggestions";
import { normalizeLocation } from "@/lib/normalize-location";

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
  const { universities, countries } = useLocationSuggestions();
  const uniListId = useId();
  const countryListId = useId();

  useEffect(() => { setUniversityName(value ?? ""); }, [value]);
  useEffect(() => { setCountryName(country ?? ""); }, [country]);

  const emit = (nextUni: string, nextCountry: string) => {
    onChange({
      universityId: null,
      universityName: normalizeLocation(nextUni),
      country: normalizeLocation(nextCountry),
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Country</Label>
        <Input
          list={countryListId}
          value={countryName}
          placeholder="Start typing — pick a match or add a new one"
          onChange={(e) => {
            setCountryName(e.target.value);
            emit(universityName, e.target.value);
          }}
          onBlur={(e) => {
            const norm = normalizeLocation(e.target.value) ?? "";
            if (norm !== e.target.value) {
              setCountryName(norm);
              emit(universityName, norm);
            }
          }}
        />
        <datalist id={countryListId}>
          {countries.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div>
        <Label className="text-xs">University</Label>
        <Input
          list={uniListId}
          value={universityName}
          placeholder="Start typing — pick a match or add a new one"
          onChange={(e) => {
            setUniversityName(e.target.value);
            emit(e.target.value, countryName);
          }}
          onBlur={(e) => {
            const norm = normalizeLocation(e.target.value) ?? "";
            if (norm !== e.target.value) {
              setUniversityName(norm);
              emit(norm, countryName);
            }
          }}
        />
        <datalist id={uniListId}>
          {universities.map((u) => <option key={u} value={u} />)}
        </datalist>
      </div>
    </div>
  );
}
