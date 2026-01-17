import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/Store';

interface SimulationItem {
  id: string;
  name: string;
  amount: number; // Negative for expense, positive for income
  date: string;
  active: boolean;
  icon: string;
}

const SimulatorScreen: React.FC = () => {
  const { transactions, userSettings } = useStore();
  
  // 0 to 100 slider, maps to 1 month to 24 months
  const [sliderVal, setSliderVal] = useState(12); 
  
  // Scenario State
  const [scenarios, setScenarios] = useState<SimulationItem[]>([
    { id: '1', name: "Bali Trip", amount: -18000, date: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0], active: true, icon: "flight" },
    { id: '2', name: "New Laptop", amount: -8500, date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0], active: true, icon: "laptop_mac" }
  ]);

  // Form State
  const [newItem, setNewItem] = useState({ name: '', amount: '', date: '' });

  // --- 1. CALCULATE BASELINE METRICS ---
  const { currentBalance, avgMonthlyNet, monthlyBurnRate, monthlyIncome } = useMemo(() => {
    // 1. Current Balance
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const bal = income - expense;

    // 2. Average Monthly Net (Last 3 months for better accuracy)
    // For simplicity in this demo, we calculate a global average per month or defaults if no data
    if (transactions.length === 0) return { currentBalance: 0, avgMonthlyNet: 0, monthlyBurnRate: 0, monthlyIncome: 0 };

    // Get range
    const dates = transactions.map(t => new Date(txDate(t.date)).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(); // now
    
    // Diff in months (avoid divide by zero)
    let monthsDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth());
    monthsDiff = Math.max(monthsDiff, 1);

    const avgNet = bal / monthsDiff; // Simple average accumulation per month
    const avgInc = income / monthsDiff;
    const avgExp = expense / monthsDiff;

    return { 
        currentBalance: bal, 
        avgMonthlyNet: avgNet,
        monthlyBurnRate: avgExp,
        monthlyIncome: avgInc
    };
  }, [transactions]);

  // --- 2. FORECASTING LOGIC ---
  const forecast = useMemo(() => {
    const monthsToProject = Math.max(Math.ceil((sliderVal / 100) * 24), 1); // 1 to 24 months
    const today = new Date();
    
    let baselinePoints: number[] = [currentBalance];
    let simulatedPoints: number[] = [currentBalance];
    let labels: string[] = ['Now'];
    let minVal = currentBalance;
    let maxVal = currentBalance;
    let lowestSimulated = currentBalance;

    for (let i = 1; i <= monthsToProject; i++) {
        const futureDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        labels.push(futureDate.toLocaleString('default', { month: 'short' }));

        // A. Baseline: Just add average net growth
        const baselineBal = currentBalance + (avgMonthlyNet * i);
        baselinePoints.push(baselineBal);

        // B. Simulation: Baseline - Scenarios that happen by this month
        let scenarioImpact = 0;
        scenarios.filter(s => s.active).forEach(s => {
            const sDate = new Date(s.date);
            // If scenario date is before or in this month
            if (sDate <= futureDate) {
                scenarioImpact += s.amount; // amount is negative for expense
            }
        });

        const simBal = baselineBal + scenarioImpact;
        simulatedPoints.push(simBal);

        // Track Min/Max for Graph Scaling
        minVal = Math.min(minVal, baselineBal, simBal);
        maxVal = Math.max(maxVal, baselineBal, simBal);
        lowestSimulated = Math.min(lowestSimulated, simBal);
    }

    return { baselinePoints, simulatedPoints, labels, minVal, maxVal, lowestSimulated };
  }, [currentBalance, avgMonthlyNet, scenarios, sliderVal]);


  // --- 3. RUNWAY CALCULATION ---
  const runwayStatus = useMemo(() => {
      // If we are net positive, infinite runway
      if (avgMonthlyNet >= 0) {
          // Check if a scenario kills us
          if (forecast.lowestSimulated < 0) return { status: 'Critical', text: 'Scenario Risk', color: 'text-danger' };
          return { status: 'Indefinite', text: 'You are cashflow positive', color: 'text-primary' };
      }

      // If net negative, how long until 0?
      // Balance / Abs(NetBurn)
      const monthsLeft = Math.abs(currentBalance / avgMonthlyNet);
      
      if (monthsLeft < 1) return { status: 'Critical', text: '< 30 Days left', color: 'text-danger' };
      if (monthsLeft < 6) return { status: `${monthsLeft.toFixed(1)} Months`, text: 'High Risk', color: 'text-orange-500' };
      return { status: `${monthsLeft.toFixed(1)} Months`, text: 'Stable for now', color: 'text-yellow-500' };

  }, [avgMonthlyNet, currentBalance, forecast.lowestSimulated]);


  // --- HANDLERS ---
  const handleAddScenario = () => {
      if (!newItem.name || !newItem.amount) return;
      
      const amt = parseFloat(newItem.amount);
      const isExpense = true; // For now, assuming adding expenses mostly

      const item: SimulationItem = {
          id: Math.random().toString(36).substr(2, 9),
          name: newItem.name,
          amount: isExpense ? -Math.abs(amt) : Math.abs(amt),
          date: newItem.date || new Date().toISOString().split('T')[0],
          active: true,
          icon: 'payments'
      };

      setScenarios([...scenarios, item]);
      setNewItem({ name: '', amount: '', date: '' });
  };

  const toggleScenario = (id: string) => {
      setScenarios(scenarios.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const removeScenario = (id: string) => {
      setScenarios(scenarios.filter(s => s.id !== id));
  };

  const currencySymbol = userSettings?.currency === 'USD' ? '$' : userSettings?.currency === 'EUR' ? '€' : '₹';

  // --- GRAPH DRAWING HELPERS ---
  const GraphPath = ({ points, color, isDashed = false, isFilled = false }: { points: number[], color: string, isDashed?: boolean, isFilled?: boolean }) => {
      const width = 1000;
      const height = 300;
      const padding = 20;
      
      // Dynamic Scaling
      const range = Math.max(forecast.maxVal - forecast.minVal, 100); // Minimum range to prevent flat line
      const mapY = (val: number) => {
          const percentage = (val - forecast.minVal) / range;
          return height - padding - (percentage * (height - (padding * 2)));
      };
      
      const stepX = width / (points.length - 1);

      let d = `M 0 ${mapY(points[0])}`;
      points.forEach((p, i) => {
          if (i === 0) return;
          const x = i * stepX;
          const y = mapY(p);
          // Curve smoothing (Catmull-Rom or simple Bezier can be added here, using straight lines for accuracy now)
          d += ` L ${x} ${y}`;
      });

      if (isFilled) {
          d += ` V ${height} H 0 Z`;
          return <path d={d} fill={color} stroke="none" opacity="0.2" />;
      }

      return (
        <path 
            d={d} 
            fill="none" 
            stroke={color} 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeDasharray={isDashed ? "10,10" : "0"} 
        />
      );
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8 p-6 md:p-10 pb-20">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-6 animate-slide-up">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-text-light-main dark:text-text-dark-main uppercase drop-shadow-lg">
            Forecasting <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Simulator</span>
          </h1>
          <p className="text-text-light-muted dark:text-text-dark-muted text-base md:text-lg max-w-xl">
            The Time Machine mode. Test your financial future with hypothetical scenarios before spending real money.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-1 pr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary animate-pulse">
            <span className="material-symbols-outlined text-sm">auto_graph</span>
          </div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase">Live Preview Active</span>
        </div>
      </header>

      {/* Stats Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up delay-100">
        {/* Stat 1: Current Balance */}
        <div className="relative overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 group transition-all hover:border-primary/50 shadow-sm">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-5xl text-text-light-main dark:text-text-dark-main">account_balance_wallet</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-text-light-muted dark:text-text-dark-muted text-sm font-medium uppercase tracking-wider">Current Balance</p>
            <p className="text-3xl font-bold text-text-light-main dark:text-text-dark-main tabular-nums tracking-tight">
                {currencySymbol}{currentBalance.toLocaleString()}
            </p>
            <div className={`flex items-center gap-1 text-sm font-bold mt-2 ${avgMonthlyNet >= 0 ? 'text-primary' : 'text-danger'}`}>
              <span className="material-symbols-outlined text-base">{avgMonthlyNet >= 0 ? 'trending_up' : 'trending_down'}</span>
              <span>{avgMonthlyNet >= 0 ? '+' : ''}{currencySymbol}{avgMonthlyNet.toFixed(0)} / mo</span>
            </div>
          </div>
        </div>
        
        {/* Stat 2: Projected Low */}
        <div className={`relative overflow-hidden rounded-2xl border p-6 shadow-lg transition-all ${forecast.lowestSimulated < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/5 border-primary/30'}`}>
          <div className="absolute right-0 top-0 p-4 opacity-20">
            <span className="material-symbols-outlined text-5xl text-current">visibility</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className={`text-sm font-medium uppercase tracking-wider ${forecast.lowestSimulated < 0 ? 'text-danger' : 'text-primary-dim'}`}>Projected Low</p>
            <p className={`text-3xl font-bold tabular-nums tracking-tight text-text-light-main dark:text-text-dark-main`} style={{textShadow: forecast.lowestSimulated >= 0 ? '0 0 20px rgba(70, 236, 19, 0.3)' : 'none'}}>
                {currencySymbol}{forecast.lowestSimulated.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 text-text-light-muted dark:text-text-dark-muted text-sm font-medium mt-2">
              <span className="material-symbols-outlined text-base">{forecast.lowestSimulated < 0 ? 'warning' : 'check_circle'}</span>
              <span>
                  {forecast.lowestSimulated < 0 
                    ? "Warning: Negative Balance" 
                    : `Safe Margin: ${((forecast.lowestSimulated / Math.max(currentBalance, 1)) * 100).toFixed(0)}% retained`}
              </span>
            </div>
          </div>
        </div>

        {/* Stat 3: Runway */}
        <div className="relative overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 group hover:border-primary/50 transition-all shadow-sm">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-5xl text-text-light-main dark:text-text-dark-main">verified_user</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-text-light-muted dark:text-text-dark-muted text-sm font-medium uppercase tracking-wider">Runway Status</p>
            <p className="text-3xl font-bold text-text-light-main dark:text-text-dark-main tracking-tight">{runwayStatus.status}</p>
            <div className={`flex items-center gap-1 text-sm font-bold mt-2 ${runwayStatus.color}`}>
              <span>{runwayStatus.text}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-up delay-200">
        {/* LEFT: GRAPH (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           <div className="rounded-3xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 md:p-8 relative overflow-hidden flex flex-col h-[500px] shadow-sm">
              {/* Graph Header */}
              <div className="flex flex-wrap justify-between items-start mb-6 z-10 relative gap-4">
                 <div>
                    <h2 className="text-xl font-bold text-text-light-main dark:text-text-dark-main">Cashflow Projection</h2>
                    <p className="text-text-light-muted dark:text-text-dark-muted text-sm">Solid line is current trajectory. Dotted line is your simulated future.</p>
                 </div>
                 <div className="flex gap-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                       <span className="text-text-light-muted dark:text-text-dark-muted">Baseline</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-1 border-t-2 border-dotted border-primary rounded-full"></div>
                       <span className="text-text-light-main dark:text-text-dark-main font-bold">Simulated</span>
                    </div>
                 </div>
              </div>
              
              {/* The Chart SVG */}
              <div className="flex-1 relative w-full h-full z-10">
                 {/* Zero Line Marker */}
                 {forecast.minVal < 0 && forecast.maxVal > 0 && (
                     <div className="absolute w-full border-t border-red-500/30 z-0" style={{top: `${(forecast.maxVal / (forecast.maxVal - forecast.minVal)) * 100}%`}}>
                        <span className="text-[10px] text-red-500 bg-surface-light dark:bg-surface-dark px-1 absolute right-0 -top-2">Zero Balance</span>
                     </div>
                 )}
                 
                 <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 300">
                    <defs>
                       <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.2"></stop>
                          <stop offset="100%" stopColor="#2ECC71" stopOpacity="0"></stop>
                       </linearGradient>
                    </defs>
                    
                    {/* Baseline Path (Gray) */}
                    <GraphPath points={forecast.baselinePoints} color="gray" isDashed={false} />
                    
                    {/* Simulated Path (Green/Red Dotted) */}
                    <GraphPath points={forecast.simulatedPoints} color={forecast.lowestSimulated < 0 ? '#EF4444' : '#2ECC71'} isDashed={true} />
                    
                    {/* Fill */}
                    <path d={`
                        M 0 300 
                        L ${forecast.simulatedPoints.map((p,i) => {
                            const range = Math.max(forecast.maxVal - forecast.minVal, 100);
                            const h = 300;
                            const pad = 20;
                            const x = i * (1000 / (forecast.simulatedPoints.length - 1));
                            const y = h - pad - (((p - forecast.minVal) / range) * (h - (pad*2)));
                            return `${x} ${y}`;
                        }).join(' L ')} 
                        V 300 H 0 Z
                    `} fill="url(#chartGradient)" opacity="0.3" stroke="none" />

                 </svg>
              </div>
              
              {/* X-Axis Labels */}
              <div className="flex justify-between text-xs text-text-light-muted dark:text-text-dark-muted font-bold mt-4 uppercase tracking-widest px-1 overflow-hidden">
                 {forecast.labels.filter((_, i) => i % Math.ceil(forecast.labels.length / 6) === 0).map((label, i) => (
                     <span key={i}>{label}</span>
                 ))}
              </div>
           </div>

           {/* Timeline Slider */}
           <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center">
                 <p className="text-sm font-bold text-text-light-main dark:text-text-dark-main uppercase tracking-wider">Forecast Duration</p>
                 <span className="text-xs text-primary font-mono">{Math.ceil((sliderVal / 100) * 24)} Months Ahead</span>
              </div>
              <div className="relative h-10 flex items-center">
                 <input 
                    className="w-full h-2 bg-gray-200 dark:bg-border-dark rounded-lg appearance-none cursor-pointer" 
                    type="range" min="5" max="100" value={sliderVal} 
                    onChange={(e) => setSliderVal(parseInt(e.target.value))}
                    style={{ accentColor: '#2ECC71' }}
                 />
              </div>
              <div className="flex justify-between text-[10px] text-text-light-muted dark:text-text-dark-muted font-medium uppercase tracking-widest">
                 <span>Today</span><span>6 Months</span><span>1 Year</span><span>2 Years</span>
              </div>
           </div>
        </div>

        {/* RIGHT: SCENARIO BUILDER (Span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-6 flex flex-col gap-6 h-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
              <div>
                 <h3 className="text-xl font-bold text-text-light-main dark:text-text-dark-main mb-1">"What If?" Scenarios</h3>
                 <p className="text-sm text-text-light-muted dark:text-text-dark-muted">Add hypothetical expenses to see how they impact your graph.</p>
              </div>

              <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                 <p className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase tracking-wider">Active Simulations</p>
                 {scenarios.length === 0 && <p className="text-xs text-text-light-muted opacity-50">No scenarios added yet.</p>}
                 {scenarios.map((sim) => (
                    <div key={sim.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${sim.active ? 'bg-gray-50 dark:bg-border-dark/30 border-border-light dark:border-border-dark/50' : 'bg-transparent border-transparent opacity-50 grayscale'}`} onClick={() => toggleScenario(sim.id)}>
                       <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-full flex items-center justify-center text-text-light-muted dark:text-text-dark-muted ${sim.active ? 'bg-gray-200 dark:bg-border-dark' : 'bg-transparent border border-gray-600'}`}>
                             <span className="material-symbols-outlined text-sm">{sim.icon}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-text-light-main dark:text-text-dark-main">{sim.name}</span>
                             <span className="text-xs text-text-light-muted dark:text-text-dark-muted">{sim.date}</span>
                          </div>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className={`text-sm font-bold ${sim.amount < 0 ? 'text-text-light-main dark:text-text-dark-main' : 'text-primary'}`}>
                             {sim.amount < 0 ? '-' : '+'}{currencySymbol}{Math.abs(sim.amount).toLocaleString()}
                          </span>
                          <button 
                             onClick={(e) => { e.stopPropagation(); removeScenario(sim.id); }}
                             className="text-[10px] text-danger opacity-0 group-hover:opacity-100 hover:underline mt-1"
                          >
                             Remove
                          </button>
                       </div>
                    </div>
                 ))}
              </div>

              <div className="h-px w-full bg-border-light dark:bg-border-dark my-2"></div>

              <div className="flex flex-col gap-4">
                 <p className="text-xs font-bold text-text-light-muted dark:text-text-dark-muted uppercase tracking-wider">New Scenario</p>
                 <div className="space-y-3">
                    <div className="relative">
                       <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-light-muted dark:text-text-dark-muted text-lg">edit</span>
                       <input 
                            className="w-full bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark text-text-light-main dark:text-text-dark-main text-sm rounded-xl py-2.5 pl-10 pr-4 focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder-gray-400 dark:placeholder:text-text-dark-muted/50" 
                            placeholder="Expense Name (e.g. Car)" 
                            type="text"
                            value={newItem.name}
                            onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="relative">
                          <span className="absolute left-3 top-2.5 text-text-light-muted dark:text-text-dark-muted font-bold text-sm">{currencySymbol}</span>
                          <input 
                            className="w-full bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark text-text-light-main dark:text-text-dark-main text-sm rounded-xl py-2.5 pl-9 pr-4 focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder-gray-400 dark:placeholder:text-text-dark-muted/50" 
                            placeholder="0.00" 
                            type="number"
                            value={newItem.amount}
                            onChange={(e) => setNewItem({...newItem, amount: e.target.value})}
                          />
                       </div>
                       <div className="relative">
                          <input 
                            className="w-full bg-background-light dark:bg-surface-darker border border-border-light dark:border-border-dark text-text-light-muted dark:text-text-dark-muted text-sm rounded-xl py-2.5 px-3 focus:ring-1 focus:ring-primary focus:border-primary outline-none" 
                            type="date"
                            style={{colorScheme: userSettings?.theme === 'light' ? 'light' : 'dark'}}
                            value={newItem.date}
                            onChange={(e) => setNewItem({...newItem, date: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>
                 <button 
                    onClick={handleAddScenario}
                    className="w-full mt-2 rounded-full bg-primary hover:bg-primary-hover text-[#131811] font-bold py-3 px-4 transition-all duration-300 flex items-center justify-center gap-2 group shadow-glow active:scale-95"
                 >
                    <span className="material-symbols-outlined text-lg transition-transform group-hover:rotate-90">add</span>
                    Add to Simulation
                 </button>
              </div>

              <div className={`mt-auto rounded-xl p-3 flex gap-3 items-start border ${forecast.lowestSimulated < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-primary/10 border-primary/20'}`}>
                 <span className={`material-symbols-outlined text-lg mt-0.5 ${forecast.lowestSimulated < 0 ? 'text-danger' : 'text-primary'}`}>info</span>
                 <p className="text-xs text-text-light-muted dark:text-text-dark-muted leading-relaxed">
                    {forecast.lowestSimulated < 0 
                        ? <span className="font-bold text-danger">Critical Alert:</span> 
                        : <span className="font-bold text-primary">Heads up:</span>
                    } 
                    {forecast.lowestSimulated < 0 
                        ? " This combination of scenarios will cause a negative balance. Reconsider timing."
                        : " You remain solvent with these additions."
                    }
                 </p>
              </div>
           </div>
        </div>
      </section>
    </div>
  );
};

// Helper for date parsing
function txDate(dateStr: string) {
    return dateStr;
}

export default SimulatorScreen;