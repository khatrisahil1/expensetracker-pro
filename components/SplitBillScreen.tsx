import React from 'react';

const SplitBillScreen: React.FC = () => {
  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a className="text-sm text-text-light-muted dark:text-text-dark-muted hover:text-primary flex items-center gap-1 cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Transactions
              </a>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-text-light-main dark:text-text-dark-main">Resolve Expense</h1>
            <p className="text-text-light-muted dark:text-text-dark-muted mt-1">Avoid awkwardness. Split it fair and square.</p>
          </div>
          <button className="bg-gray-100 dark:bg-border-dark hover:bg-gray-200 dark:hover:bg-surface-darker text-sm text-text-light-main dark:text-text-dark-main font-medium px-5 py-2.5 rounded-full border border-transparent transition-colors flex items-center gap-2 w-fit">
            <span className="material-symbols-outlined text-[18px]">history</span> History
          </button>
        </div>

        {/* Transaction Card */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="w-full md:w-48 aspect-video rounded-lg bg-cover bg-center shrink-0 relative overflow-hidden group" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAsJciINVGaLed_UwiBzAh1yyZGwTESK4vEr1_i-Y8-q3A3xkL-sSLVUFIjz8NPijnkcoT8XIVvsL8x_oQ3Rp5nApKiMU-c-Fjk1t7Pl0pElNZ-1bR3HarBuwMuAdPQ5CPbAFHdKBMjvyVFlTu4jjV-T7PDj7w_AwL-JUimjKjg0ok_5AHkPdD6NJSIjjnFgv35vzdBQZ_P59xKR71h69wmVFI92T6zcdCYApqyWz8ukoCP5tmZeizJj16Vb_5XsUmfZlviD4LlC0E")'}}>
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
            </div>
            <div className="flex-1 w-full">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Sushi Sambar</h3>
                  <p className="text-text-light-muted dark:text-text-dark-muted text-sm flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[16px]">restaurant</span> Dining Out • Yesterday, 8:30 PM
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-2xl font-bold text-text-light-main dark:text-text-dark-main">₹128.50</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-border-dark text-text-light-muted dark:text-text-dark-muted">Paid by you</span>
                </div>
              </div>
              <div className="h-px w-full bg-border-light dark:bg-border-dark my-4"></div>
              <div className="flex justify-between items-center">
                <div className="flex -space-x-2">
                  <div className="size-8 rounded-full border-2 border-surface-light dark:border-surface-dark bg-primary flex items-center justify-center text-[10px] font-bold text-background-dark z-10">YOU</div>
                  <div className="size-8 rounded-full border-2 border-surface-light dark:border-surface-dark bg-gray-200 dark:bg-border-dark flex items-center justify-center text-gray-500">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </div>
                </div>
                <button className="text-primary text-sm font-semibold hover:underline">View Receipt</button>
              </div>
            </div>
          </div>
        </div>

        {/* Splitter Module */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 lg:p-8 shadow-sm border border-border-light dark:border-border-dark">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <span className="material-symbols-outlined">call_split</span>
            </div>
            <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Split this Bill</h3>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border-light dark:border-border-dark gap-8 mb-8 overflow-x-auto">
            <button className="flex items-center gap-2 border-b-[3px] border-primary text-text-light-main dark:text-text-dark-main pb-3 px-1 transition-colors whitespace-nowrap">
              <span className="material-symbols-outlined text-[18px]">percent</span> <span className="text-sm font-bold">By Percentage</span>
            </button>
            <button className="flex items-center gap-2 border-b-[3px] border-transparent text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main pb-3 px-1 transition-colors whitespace-nowrap">
              <span className="material-symbols-outlined text-[18px]">attach_money</span> <span className="text-sm font-bold">By Amount</span>
            </button>
            <button className="flex items-center gap-2 border-b-[3px] border-transparent text-text-light-muted dark:text-text-dark-muted hover:text-text-light-main dark:hover:text-text-dark-main pb-3 px-1 transition-colors whitespace-nowrap">
              <span className="material-symbols-outlined text-[18px]">balance</span> <span className="text-sm font-bold">Even Split</span>
            </button>
          </div>

          {/* Friends Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-text-light-muted dark:text-text-dark-muted mb-3">Split with whom?</label>
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              <button className="shrink-0 size-12 rounded-full border border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-border-dark transition-colors group">
                <span className="material-symbols-outlined text-gray-400 group-hover:text-primary">person_add</span>
              </button>
              <div className="shrink-0 flex flex-col items-center gap-1 cursor-pointer">
                <div className="size-12 rounded-full bg-cover bg-center border-2 border-primary relative" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuACAubVoNERCZuXwpwqDYk-EGPodyTxLqE-ab4x5yqka04dopWvdgttr80ZW4xhZyY0ZlN-WlYoVqG4W_4fFGzAiacwbShly_fedpGKXgQ0Y5V9x0ERkSeMM63vtbb9_gnRDF6FIoJSHO6VYLgrlCDoS0m19zWzt0ksTwN59ilOSHZWLD9TDg0_QxCOGg-jxlWhBOJHY3T41h5Xri3vTXWVqU1Fh7qiDgufPBlw2lPH3fbesTtFTG4dYM2EoPlK2O32d0lJgI4pKtY")'}}>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-background-dark rounded-full size-5 flex items-center justify-center border-2 border-surface-light dark:border-surface-dark">
                    <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-text-light-main dark:text-text-dark-main">Mike</span>
              </div>
               <div className="shrink-0 flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
                <div className="size-12 rounded-full bg-cover bg-center border-2 border-transparent hover:border-gray-400" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCEJZNnZGdqtA8nqRTfI07Y4EuE7TIEu8-KGDmN6nQeJHHhJgyWzquTGfFMJwHO6UHVKgB-Hrbw1tXaAEwH3opmRM1MkbYoApxPsK296xQJ9CXB89J6i3V_FkeEoIAxVuewjYF-1bxZagJjZs5BOW0iGxNRSLRYIzMwHRXaUxS51ejlZW_cq9v6XkEN9jH719BeXDLcHrJeDcXduULmqMH2lWkXcH1rx6Vd2h49Eo_CC6FOt_6gJB-gzK-saWGAXin4KPuTJVf51xI")'}}></div>
                <span className="text-xs font-medium text-text-light-main dark:text-text-dark-main">Sarah</span>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="bg-background-light dark:bg-surface-darker rounded-2xl p-6 mb-8 border border-border-light dark:border-none">
            <div className="flex justify-between mb-4 text-sm font-medium">
              <span className="text-primary">You pay 50%</span>
              <span className="text-text-light-muted dark:text-text-dark-muted">Mike pays 50%</span>
            </div>
            <div className="relative h-6 mb-6">
              <div className="absolute top-1/2 left-0 w-full h-4 bg-gray-200 dark:bg-border-dark rounded-full -translate-y-1/2 overflow-hidden">
                <div className="h-full bg-primary w-1/2"></div>
              </div>
              <input className="absolute top-0 w-full h-full opacity-0 cursor-pointer z-10" type="range" max="100" min="0" defaultValue="50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-7 bg-white dark:bg-background-dark border-4 border-primary rounded-full shadow-lg pointer-events-none flex items-center justify-center">
                 <span className="material-symbols-outlined text-[14px] text-primary">drag_handle</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 bg-gray-100 dark:bg-border-dark p-4 rounded-xl border border-primary/30">
                <p className="text-xs text-text-light-muted dark:text-text-dark-muted mb-1">Your Share</p>
                <p className="text-xl font-bold text-text-light-main dark:text-text-dark-main">₹64.25</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="material-symbols-outlined text-gray-400">arrow_forward</span>
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-border-dark p-4 rounded-xl border border-transparent">
                <p className="text-xs text-text-light-muted dark:text-text-dark-muted mb-1">Mike Owes</p>
                <p className="text-xl font-bold text-primary">₹64.25</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 border-t border-border-light dark:border-border-dark">
            <button className="px-6 py-3 rounded-full text-text-light-muted dark:text-text-dark-muted font-medium text-sm hover:bg-gray-100 dark:hover:bg-border-dark transition-colors">Cancel</button>
            <button className="px-8 py-3 bg-primary hover:bg-primary-hover text-background-dark font-bold rounded-full text-sm transition-all shadow-[0_0_20px_rgba(70,236,19,0.3)] hover:shadow-[0_0_30px_rgba(70,236,19,0.4)] flex items-center gap-2">
              Send Request <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Sidebar */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-text-light-main dark:text-text-dark-main">Settlement Status</h3>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-full transition-colors">
              <span className="material-symbols-outlined text-gray-500">more_horiz</span>
            </button>
          </div>
          
          <div className="bg-background-light dark:bg-surface-darker border border-border-light dark:border-none rounded-xl p-5 mb-6 text-center">
            <p className="text-xs text-text-light-muted dark:text-text-dark-muted mb-2 uppercase tracking-wider font-bold">Total Owed To You</p>
            <p className="text-4xl font-extrabold text-primary mb-1">₹145.00</p>
            <p className="text-xs text-gray-400">Across 3 friends</p>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Active</p>
            
            {/* John */}
            <div className="group relative bg-orange-50 dark:bg-[#2c1e14] border border-orange-200 dark:border-orange-900/50 p-4 rounded-xl transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-cover bg-center" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCZNlakwoEQN-VMf3fta9J-IDuBMbBcMRA4_i_4m3tBXP6qgRU8ivVwgsNFrmV-E_nMdK_A5-eG3kGWBeEKYlwPasnjqWcQ2pUXLF2Q9Cu_-kpssfj7XNV4hkNsKgIuItlXzrqTyN9bicgQsSWHc62vlQiUDiCfDBT1HebowjX7CBcCewayJhwcFCRHcQpMeCx614QP5tbOzNyGkW1X6BL7V7byXs77AwnQAo2YnQVuImi7aPv8Lir_HjrAsjhDGXVQ6fgQpr-bpDg")'}}></div>
                  <div>
                    <p className="font-bold text-text-light-main dark:text-text-dark-main text-sm">John D.</p>
                    <p className="text-orange-500 text-xs font-bold">Overdue (2 days)</p>
                  </div>
                </div>
                <p className="font-bold text-text-light-main dark:text-text-dark-main">₹45.00</p>
              </div>
              <button className="w-full py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-bold hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">notifications_active</span> Nudge John
              </button>
            </div>

            {/* Lisa */}
            <div className="group relative bg-surface-light dark:bg-surface-darker border border-border-light dark:border-border-dark p-4 rounded-xl transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-cover bg-center" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA4KnG2CcekBWqEW6eNL79pOqJPzUQVMOzvcpg21afyyplSZTDXAt-sH8cBcyLFbmzOStS2FYc1hpMgYRcg1HJw2IriqyCUZs6ioYjR7p7Warm2vyaUhk87szGwvJZ4hrvr4d0qXf54o6mCMsh-na3hvV0fKfcHOSkN_QMiK8C3-ehgIPKkrN6l-q-SDBkUF22AYUta19Y_c7uFYfaUsMTNiA3bUucSr783cNjxR1hYdI7lwoJ5baf45YT9gCilfrGFWBU0ZXhCE9A")'}}></div>
                  <div>
                    <p className="font-bold text-text-light-main dark:text-text-dark-main text-sm">Lisa M.</p>
                    <p className="text-text-light-muted dark:text-text-dark-muted text-xs">Pending acceptance</p>
                  </div>
                </div>
                <p className="font-bold text-text-light-main dark:text-text-dark-main">₹75.00</p>
              </div>
               <div className="flex justify-end">
                <button className="text-xs text-gray-400 hover:text-text-light-main dark:hover:text-text-dark-main flex items-center gap-1 transition-colors">
                  <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                </button>
              </div>
            </div>

            {/* Settled */}
             <div className="opacity-75 hover:opacity-100 transition-opacity">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 mb-2 mt-6">Recently Settled</p>
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-surface-darker border border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="size-8 rounded-full bg-cover bg-center grayscale" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCSgox4LhH9IhS8zCxii5KjgCGwE5rf3l_qYcZrT-UD-rwyXgnjcNL2wsQ7uFucuQ8a4UXig3Y-YMvSSXVjdWsJit95NQJrRv7BKnPAG97pUn_IY_UsEq3ExE3xvU5X92IG5nOJgVo6gDZSsuoskgpg9LmSmKvkIoGYjbNuenFRCAWaYBNgcP7lNQ2qNs8tUVpcoy0l1Rk-M1b6YOlkhbc_NaNcMLaK9leuVviVG0yuXXFRasea5UQHQGP5v5RM0n09XxUkQjD_vEY")'}}></div>
                        <div className="absolute -bottom-1 -right-1 bg-primary rounded-full size-3 border border-surface-light dark:border-surface-dark"></div>
                    </div>
                    <p className="text-sm font-medium text-text-light-muted dark:text-text-dark-muted">Mike</p>
                    </div>
                    <p className="text-sm font-bold text-primary">+₹25.00</p>
                </div>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <div className="bg-primary/10 rounded-lg p-3 flex gap-3 items-start">
              <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">tips_and_updates</span>
              <p className="text-xs text-text-light-muted dark:text-text-dark-muted leading-relaxed">
                <span className="font-bold text-primary">Pro Tip:</span> Regular nudges (once a week) are 40% more effective than waiting until the end of the month.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplitBillScreen;