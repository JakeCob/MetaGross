"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  showValue?: boolean;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className = "",
      label,
      showValue = true,
      min = 0,
      max = 100,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const displayValue = value ?? defaultValue ?? min;

    return (
      <div className="flex flex-col gap-2">
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label className="text-sm font-medium text-foreground">
                {label}
              </label>
            )}
            {showValue && (
              <span className="text-sm font-mono text-muted">
                {displayValue}%
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          value={value}
          defaultValue={defaultValue}
          className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-card-border accent-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Slider.displayName = "Slider";
