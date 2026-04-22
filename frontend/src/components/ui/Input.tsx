import * as React from "react";
import { cn } from "@/lib/cn";

const base =
  "w-full rounded-lg border bg-paper-0 text-ink-8 placeholder:text-ink-4 " +
  "transition-all duration-200 ease-editorial " +
  "focus:outline-none focus:ring-2 focus:ring-brand-400/60 focus:border-brand-500 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

type FieldProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
};

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  FieldProps;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { className, label, hint, error, leadingIcon, trailingIcon, id, ...props },
    ref,
  ) {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const invalid = Boolean(error);
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-ink-6 tracking-wide"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leadingIcon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4">
              {leadingIcon}
            </span>
          ) : null}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={invalid || undefined}
            className={cn(
              base,
              "h-10 px-3.5 text-sm",
              leadingIcon && "pl-10",
              trailingIcon && "pr-10",
              invalid
                ? "border-danger focus:ring-danger/40 focus:border-danger"
                : "border-ink-2 hover:border-ink-3",
              className,
            )}
            {...props}
          />
          {trailingIcon ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4">
              {trailingIcon}
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-5">{hint}</p>
        ) : null}
      </div>
    );
  },
);

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldProps;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, label, hint, error, id, ...props }, ref) {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const invalid = Boolean(error);
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-ink-6 tracking-wide"
          >
            {label}
          </label>
        ) : null}
        <textarea
          id={inputId}
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            base,
            "min-h-[96px] px-3.5 py-2.5 text-sm leading-relaxed resize-y",
            invalid
              ? "border-danger focus:ring-danger/40 focus:border-danger"
              : "border-ink-2 hover:border-ink-3",
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-5">{hint}</p>
        ) : null}
      </div>
    );
  },
);
