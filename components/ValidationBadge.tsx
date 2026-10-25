'use client';

import { CheckCircle2, AlertTriangle, XCircle, KeyRound } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ValidationResult } from '@/lib/validator';

interface ValidationBadgeProps {
  validation: ValidationResult | null;
}

export default function ValidationBadge({ validation }: ValidationBadgeProps) {
  if (!validation) return null;

  const { isValid, errors, warnings, credentialsNeeded } = validation;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.97] focus:outline-none focus:ring-4 focus:ring-[#FF6D5A]/10 cursor-pointer"
          style={{
            backgroundColor: !isValid
              ? 'rgba(239, 68, 68, 0.15)'
              : warnings.length > 0
              ? 'rgba(245, 158, 11, 0.15)'
              : 'rgba(34, 197, 94, 0.15)',
            borderColor: !isValid
              ? 'rgba(239, 68, 68, 0.35)'
              : warnings.length > 0
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(34, 197, 94, 0.35)',
            color: !isValid
              ? '#f87171'
              : warnings.length > 0
              ? '#fbbf24'
              : '#4ade80',
          }}
        >
          {!isValid ? (
            <>
              <XCircle className="w-3.5 h-3.5" />
              <span>Invalid ({errors.length})</span>
            </>
          ) : warnings.length > 0 ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {warnings.length} warning{warnings.length > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Valid</span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 sm:w-84 p-3.5 max-h-80 overflow-y-auto bg-[#0C0C0F]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl rounded-xl"
        align="end"
        data-lenis-prevent="true"
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
            <span className="text-xs font-semibold text-zinc-100">
              Workflow Validation Status
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded font-mono font-medium"
              style={{
                backgroundColor: !isValid
                  ? 'rgba(239, 68, 68, 0.2)'
                  : warnings.length > 0
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(34, 197, 94, 0.2)',
                color: !isValid
                  ? '#f87171'
                  : warnings.length > 0
                  ? '#fbbf24'
                  : '#4ade80',
              }}
            >
              {!isValid ? 'Schema Failure' : warnings.length > 0 ? 'Review Warnings' : 'Ready to Import'}
            </span>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-red-400">Errors</span>
              {errors.map((err, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-red-950/40 border border-red-900/50 text-xs text-red-300 leading-snug"
                >
                  {err.message}
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-amber-400">Warnings</span>
              {warnings.map((warn, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-amber-950/40 border border-amber-900/50 text-xs text-amber-300 leading-snug"
                >
                  {warn.message}
                </div>
              ))}
            </div>
          )}

          {/* Credentials needed */}
          {credentialsNeeded.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1 border-t border-[#2e2e35] pt-2">
              <div className="flex items-center gap-1.5 text-zinc-200 text-xs font-semibold">
                <KeyRound className="w-3.5 h-3.5 text-[#FF6D5A]" />
                <span>Credentials Needed ({credentialsNeeded.length})</span>
              </div>
              <p className="text-xs text-zinc-400">
                Secrets were replaced with placeholders for security:
              </p>
              <div className="flex flex-col gap-1">
                {credentialsNeeded.map((cred, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded-lg bg-[#1f1f23] border border-[#2e2e35] text-xs text-zinc-200 flex items-center justify-between font-mono"
                  >
                    <span className="text-zinc-400">{cred.node}</span>
                    <span className="text-[#FF6D5A]">{cred.placeholder}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isValid && errors.length === 0 && warnings.length === 0 && credentialsNeeded.length === 0 && (
            <p className="text-xs text-zinc-300 leading-relaxed py-1">
              ✓ All structural rules satisfied: exactly 1 trigger, all connection targets exist, unique node names, and standard n8n coordinates.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
