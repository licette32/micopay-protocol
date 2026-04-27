interface DeleteAccountModalProps {
  username: string;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
}

const DeleteAccountModal = ({
  username,
  confirmation,
  onConfirmationChange,
  onCancel,
  onConfirm,
  loading = false,
  error = null,
}: DeleteAccountModalProps) => {
  const canConfirm = confirmation.trim() === username && !loading;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Cerrar confirmación"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl border border-[#F5B6C0]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFECEF] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#C62828] text-3xl">
              warning
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#C62828] mb-1">
              Confirmación necesaria
            </p>
            <h2 className="text-2xl font-extrabold text-[#0B1E26] leading-tight">
              ¿Seguro que quieres eliminar tu cuenta?
            </h2>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-sm text-[#67808C] leading-relaxed">
            Esta acción es irreversible. Tu cuenta será anonimizada y no podrás
            recuperarla después de confirmar.
          </p>

          <div className="rounded-2xl bg-[#FFECEF] border border-[#F5B6C0] p-4">
            <p className="text-sm text-[#C62828] font-medium leading-relaxed">
              Escribe <span className="font-bold font-mono">@{username}</span>{" "}
              para habilitar el botón de eliminación.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#67808C] mb-2 uppercase tracking-wide">
              Confirmar usuario
            </label>
            <input
              autoFocus
              value={confirmation}
              onChange={(e) => onConfirmationChange(e.target.value)}
              placeholder={username}
              className="w-full bg-[#F7FBFD] border border-[#D7E3EA]/70 rounded-2xl px-4 py-3 text-base font-medium focus:outline-none focus:border-[#C62828] transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-[#F5B6C0] bg-[#FFECEF] px-4 py-3">
              <p className="text-sm text-[#C62828] font-medium">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-[#D7E3EA] bg-white px-4 py-3 font-bold text-[#0B1E26] transition-colors hover:bg-[#F7FBFD]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-2xl bg-[#C62828] px-4 py-3 font-bold text-white shadow-lg shadow-[#C62828]/20 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-lg">
                  progress_activity
                </span>
                Eliminando…
              </span>
            ) : (
              "Sí, eliminar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
