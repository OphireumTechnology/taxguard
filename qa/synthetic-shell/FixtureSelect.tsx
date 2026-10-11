import React from 'react';

/** Keep option text outside the label so exact label queries remain stable. */
export function FixtureSelect({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: readonly string[]; onChange: (value: string) => void;
}) {
  return <div className="qa-select-control"><label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select></div>;
}
