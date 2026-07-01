'use client';

interface KPICardsProps {
  todayRevenue: number;
  activeConversations: number;
  todayCustomers: number;
  ordersToday: number;
  corrugatorUtilization: number;
  revenuePipeline: number;
}

export function KPICards({
  todayRevenue,
  activeConversations,
  todayCustomers,
  ordersToday,
  corrugatorUtilization,
  revenuePipeline,
}: KPICardsProps) {
  const cards = [
    {
      label: "Today's Revenue",
      value: `₹${(todayRevenue || 0).toLocaleString('en-IN')}`,
      subtitle: `${ordersToday} quote${ordersToday !== 1 ? 's' : ''} today`,
      color: 'from-emerald-50 to-green-50 border-emerald-200',
      icon: '💰',
      valueColor: 'text-emerald-700',
    },
    {
      label: 'Active Conversations',
      value: String(activeConversations || 0),
      subtitle: `${todayCustomers} new customer${todayCustomers !== 1 ? 's' : ''} today`,
      color: 'from-blue-50 to-indigo-50 border-blue-200',
      icon: '💬',
      valueColor: 'text-blue-700',
    },
    {
      label: 'Corrugator Capacity',
      value: `${corrugatorUtilization || 0}%`,
      subtitle: `${revenuePipeline > 0 ? '₹' + (revenuePipeline / 100000).toFixed(1) + 'L pipeline' : 'No active pipeline'}`,
      color: corrugatorUtilization > 80 ? 'from-red-50 to-rose-50 border-red-200' : 'from-violet-50 to-purple-50 border-violet-200',
      icon: '🏭',
      valueColor: corrugatorUtilization > 80 ? 'text-red-700' : 'text-violet-700',
    },
    {
      label: 'Revenue Pipeline',
      value: `₹${((revenuePipeline || 0) / 100000).toFixed(1)}L`,
      subtitle: 'Last 30 days',
      color: 'from-amber-50 to-yellow-50 border-amber-200',
      icon: '📊',
      valueColor: 'text-amber-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-gradient-to-br ${card.color} border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow`}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">{card.label}</span>
            <span className="text-xl">{card.icon}</span>
          </div>
          <div className={`text-3xl font-bold ${card.valueColor} mb-1`}>
            {card.value}
          </div>
          <div className="text-xs text-gray-500">{card.subtitle}</div>
        </div>
      ))}
    </div>
  );
}

