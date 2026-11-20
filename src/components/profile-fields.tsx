// Plain inputs (no client hooks) so these work inside both server and client forms.

type Vals = Record<string, string | undefined> | undefined;

export function GuardianFields({ v, idp = "g" }: { v?: Vals; idp?: string }) {
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${idp}-name`}>Guardian name</label>
        <input id={`${idp}-name`} name="guardianName" defaultValue={v?.guardianName} maxLength={120} autoComplete="off" className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-phone`}>Guardian mobile</label>
        <input id={`${idp}-phone`} name="guardianPhone" type="tel" inputMode="tel" defaultValue={v?.guardianPhone} placeholder="0300-1234567" maxLength={20} autoComplete="off" className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-cnic`}>Guardian ID card (CNIC)</label>
        <input id={`${idp}-cnic`} name="guardianCnic" inputMode="numeric" defaultValue={v?.guardianCnic} placeholder="35202-1234567-1" maxLength={15} autoComplete="off" className="input" />
      </div>
    </>
  );
}

export function StaffFields({ v, suggestions = [], idp = "s" }: { v?: Vals; suggestions?: string[]; idp?: string }) {
  const listId = `${idp}-subjects`;
  return (
    <>
      <div>
        <label className="label" htmlFor={`${idp}-phone`}>Mobile</label>
        <input id={`${idp}-phone`} name="phone" type="tel" inputMode="tel" defaultValue={v?.phone} placeholder="0300-1234567" maxLength={20} autoComplete="off" className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-cnic`}>ID card (CNIC)</label>
        <input id={`${idp}-cnic`} name="cnic" inputMode="numeric" defaultValue={v?.cnic} placeholder="35202-1234567-1" maxLength={15} autoComplete="off" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${idp}-spec`}>Specialised in (subjects, separated by commas)</label>
        <input id={`${idp}-spec`} name="specializations" defaultValue={v?.specializations} list={listId} placeholder="e.g. Mathematics, Physics" maxLength={400} autoComplete="off" className="input" />
        {suggestions.length > 0 && <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
      </div>
    </>
  );
}
