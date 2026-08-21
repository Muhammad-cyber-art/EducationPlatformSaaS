import { MessageSquare, Activity, Users } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie as RechartsPie, Cell as RechartsCell, BarChart as RechartsBarChart, Bar as RechartsBar, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer as RechartsResponsiveContainer, AreaChart as RechartsAreaChart, Area as RechartsArea, Cell } from 'recharts';

export const BotConnectionsChart = ({ botStats }) => {
    const data = [
        { name: 'Ulangan', value: Number(botStats?.total_bot_users || 0), color: '#b8860b' },
        { name: 'Ulanmagan', value: Number(botStats?.unregistered_students || 0), color: '#ef4444' },
    ];

    return (
        <div className="lux-card p-3 md:p-4 flex flex-col items-center">
            <div className="w-full flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-[var(--gold)]" />
                <h3 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">Bot Ulanmalari</h3>
            </div>

            <div className="w-full h-[160px] md:h-[200px]">
                <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <RechartsPie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius="50%"
                            outerRadius="80%"
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <RechartsCell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </RechartsPie>
                        <RechartsTooltip
                            contentStyle={{
                                backgroundColor: 'var(--bg-void)',
                                border: '1px solid var(--border-glass)',
                                borderRadius: '8px',
                                fontSize: '11px'
                            }}
                            itemStyle={{ fontWeight: 'bold' }}
                            labelStyle={{ color: 'var(--text-muted)', fontWeight: 'bold' }}
                        />
                    </RechartsPieChart>
                </RechartsResponsiveContainer>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mt-1 w-full">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[9px] font-black text-[var(--text-muted)]">{item.name}: {item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AbsenteesChart = ({ stats }) => {
    const data = [
        { name: 'Keldi', value: Number((stats?.attendance_today?.total || 0) - (stats?.attendance_today?.absent || 0)) },
        { name: 'Kelmadi', value: Number(stats?.attendance_today?.absent || 0) },
    ];

    return (
        <div className="lux-card p-3 md:p-4 flex flex-col items-center">
            <div className="w-full flex items-center gap-2 mb-2">
                <Activity size={14} className="text-red-500" />
                <h3 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">Bugungi Davomat</h3>
            </div>

            <div className="w-full h-[160px] md:h-[200px]">
                <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <RechartsPie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius="50%"
                            outerRadius="80%"
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            <RechartsCell fill="#22c55e" />
                            <RechartsCell fill="#ef4444" />
                        </RechartsPie>
                        <RechartsTooltip
                            contentStyle={{
                                backgroundColor: 'var(--bg-void)',
                                border: '1px solid var(--border-glass)',
                                borderRadius: '8px',
                                fontSize: '11px'
                            }}
                            itemStyle={{ fontWeight: 'bold' }}
                            labelStyle={{ color: 'var(--text-muted)', fontWeight: 'bold' }}
                        />
                    </RechartsPieChart>
                </RechartsResponsiveContainer>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mt-1 w-full">
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black text-[var(--text-muted)]">Keldi: {data[0].value}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[9px] font-black text-[var(--text-muted)]">Kelmadi: {data[1].value}</span>
                </div>
            </div>
        </div>
    );
};



export const StudentGrowthChart = ({ data }) => {
    return (
        <div className="lux-card p-3 md:p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-[var(--gold)]" />
                <h3 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">O'quvchilar Dinamikasi</h3>
            </div>

            <div className="w-full h-[200px] md:h-[240px]">
                {data && data.length > 0 ? (
                    <RechartsResponsiveContainer width="100%" height="100%">
                        <RechartsAreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorKelganlar" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorKetganlar" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <RechartsXAxis
                                dataKey="name"
                                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <RechartsYAxis
                                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <RechartsCartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-void)',
                                    border: '1px solid var(--border-glass)',
                                    borderRadius: '8px',
                                    fontSize: '11px'
                                }}
                                itemStyle={{ fontWeight: 'bold' }}
                                labelStyle={{ color: 'var(--text-muted)', fontWeight: 'bold' }}
                            />
                            <RechartsArea type="monotone" dataKey="Kelganlar" stroke="#22c55e" fillOpacity={1} fill="url(#colorKelganlar)" strokeWidth={2} />
                            <RechartsArea type="monotone" dataKey="Ketganlar" stroke="#ef4444" fillOpacity={1} fill="url(#colorKetganlar)" strokeWidth={2} />
                        </RechartsAreaChart>
                    </RechartsResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center border border-dashed border-[var(--border-glass)] rounded-xl">
                        <p className="text-[9px] text-[var(--text-muted)] font-black capitalize tracking-widest">
                            Ma'lumot topilmadi
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
