"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  label: string;
  pendingLabel?: string;
};

export function SubmitButton({ label, pendingLabel = "Working..." }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
