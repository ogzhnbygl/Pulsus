import React, { useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, Trash2, X, Loader2 } from 'lucide-react';

/**
 * ConfirmModal - An accessible, clean Tailwind confirmation and alert modal
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {string} title - Header title
 * @param {React.ReactNode} message - Body message or description
 * @param {string} [confirmText='Onayla'] - Confirm button text
 * @param {string} [cancelText='İptal'] - Cancel button text
 * @param {Function} onConfirm - Confirm callback
 * @param {Function} onCancel - Cancel / close callback
 * @param {Function} [onClose] - Optional alias for onCancel
 * @param {'danger'|'warning'|'info'} [variant='danger'] - Visual styling variant
 * @param {boolean} [isLoading=false] - Loading spinner state for confirm action
 * @param {boolean} [hideCancel=false] - True if used as an alert/notice modal
 */
export default function ConfirmModal({
    isOpen,
    title = 'İşlemi Onaylayın',
    message,
    confirmText,
    cancelText = 'İptal',
    onConfirm,
    onCancel,
    onClose,
    variant = 'danger',
    isLoading = false,
    hideCancel = false
}) {
    const handleClose = onCancel || onClose;
    const confirmButtonRef = useRef(null);

    // Default confirm text based on mode and variant
    const resolvedConfirmText = confirmText || (hideCancel ? 'Tamam' : variant === 'danger' ? 'Evet, Sil' : 'Onayla');

    // Handle ESC key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = e => {
            if (e.key === 'Escape' && !isLoading && handleClose) {
                handleClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isLoading, handleClose]);

    // Auto-focus on open
    useEffect(() => {
        if (isOpen && confirmButtonRef.current) {
            confirmButtonRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Visual theme variants
    const variantStyles = {
        danger: {
            iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
            icon: Trash2,
            confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 shadow-sm shadow-rose-200'
        },
        warning: {
            iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
            icon: AlertTriangle,
            confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500 shadow-sm shadow-amber-200'
        },
        info: {
            iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
            icon: Info,
            confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm shadow-blue-200'
        }
    };

    const currentVariant = variantStyles[variant] || variantStyles.danger;
    const IconComponent = currentVariant.icon;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-description"
        >
            {/* Backdrop click dismiss */}
            <div
                className="fixed inset-0 -z-10"
                onClick={() => {
                    if (!isLoading && handleClose) handleClose();
                }}
            />

            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${currentVariant.iconBg}`}>
                            <IconComponent size={20} />
                        </div>
                        <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900">
                            {title}
                        </h3>
                    </div>
                    {handleClose && (
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                            aria-label="Kapat"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                    <div id="confirm-modal-description" className="text-sm text-slate-600 leading-relaxed">
                        {message}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    {!hideCancel && handleClose && (
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 transition-colors ${currentVariant.confirmBtn}`}
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        <span>{resolvedConfirmText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
