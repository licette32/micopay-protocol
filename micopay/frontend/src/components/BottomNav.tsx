interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const BottomNav = ({ currentPage, onNavigate }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-8 pt-3 bg-[#F4FAFF]/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_-8px_32px_rgba(11,30,38,0.04)] rounded-t-[32px]">
      {/* Inicio */}
      <button
        onClick={() => onNavigate('home')}
        aria-label="Inicio"
        aria-current={currentPage === 'home' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center rounded-full px-5 py-2 transition-all active:scale-90 duration-150 focus:outline-none focus:ring-2 focus:ring-primary ${
          currentPage === 'home'
            ? 'bg-[#E1F5EE] dark:bg-[#00694C]/30 text-[#00694C] dark:text-[#5DCAA5]'
            : 'text-[#0B1E26] dark:text-slate-400 opacity-70 hover:opacity-100'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined" style={{ fontVariationSettings: currentPage === 'home' ? '"FILL" 1' : '"FILL" 0' }}>home</span>
        <span className="font-['Manrope'] font-medium text-[10px] tracking-wide">Inicio</span>
      </button>

      {/* Pagar / Convertir */}
      <button
        onClick={() => onNavigate('cashout')}
        aria-label="Pagar"
        aria-current={currentPage === 'cashout' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center rounded-full px-5 py-2 transition-all active:scale-90 duration-150 focus:outline-none focus:ring-2 focus:ring-primary ${
          currentPage === 'cashout'
            ? 'bg-[#E1F5EE] dark:bg-[#00694C]/30 text-[#00694C] dark:text-[#5DCAA5]'
            : 'text-[#0B1E26] dark:text-slate-400 opacity-70 hover:opacity-100'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined" style={{ fontVariationSettings: currentPage === 'cashout' ? '"FILL" 1' : '"FILL" 0' }}>payments</span>
        <span className="font-['Manrope'] font-medium text-[10px] tracking-wide">Pagar</span>
      </button>

      {/* Explorar */}
      <button
        onClick={() => onNavigate('explore')}
        aria-label="Explorar"
        aria-current={currentPage === 'explore' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center rounded-full px-5 py-2 transition-all active:scale-90 duration-150 focus:outline-none focus:ring-2 focus:ring-primary ${
          currentPage === 'explore'
            ? 'bg-[#E1F5EE] dark:bg-[#00694C]/30 text-[#00694C] dark:text-[#5DCAA5]'
            : 'text-[#0B1E26] dark:text-slate-400 opacity-70 hover:opacity-100'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined" style={{ fontVariationSettings: currentPage === 'explore' ? '"FILL" 1' : '"FILL" 0' }}>explore</span>
        <span className="font-['Manrope'] font-medium text-[10px] tracking-wide">Explorar</span>
      </button>

      {/* Perfil */}
      <button
        onClick={() => onNavigate('profile')}
        aria-label="Perfil"
        aria-current={currentPage === 'profile' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center rounded-full px-5 py-2 transition-all active:scale-90 duration-150 focus:outline-none focus:ring-2 focus:ring-primary ${
          currentPage === 'profile'
            ? 'bg-[#E1F5EE] dark:bg-[#00694C]/30 text-[#00694C] dark:text-[#5DCAA5]'
            : 'text-[#0B1E26] dark:text-slate-400 opacity-70 hover:opacity-100'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined" style={{ fontVariationSettings: currentPage === 'profile' ? '"FILL" 1' : '"FILL" 0' }}>person</span>
        <span className="font-['Manrope'] font-medium text-[10px] tracking-wide">Perfil</span>
      </button>
    </nav>
  );
};

export default BottomNav;
