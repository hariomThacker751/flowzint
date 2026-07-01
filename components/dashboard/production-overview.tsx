'use client';

interface MonthlyCapacity {
  monthKey: string;
  totalKg: number;
  bookedKg: number;
  availableKg: number;
  utilizationPct: number;
  activeBookings: number;
}

interface RecentBooking {
  id: string;
  monthKey: string;
  customerName: string;
  kgBooked: number;
  deliveryEstimateDays: number;
  status: string;
}

interface ProductionOverviewProps {
  corrugatorUtilization: number;
  bookedKg: number;
  totalMonthlyCapacityKg: number;
  monthlyCapacities: MonthlyCapacity[];
  recentBookings: RecentBooking[];
}

export function ProductionOverview({
  corrugatorUtilization,
  bookedKg,
  totalMonthlyCapacityKg,
  monthlyCapacities,
  recentBookings,
}: ProductionOverviewProps) {
  const currentCap = monthlyCapacities[0];
  const nextCap = monthlyCapacities[1];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-gray-900">🏭 Production</h3>
        <span className="text-xs text-gray-400">45 corrugators · 150 kg/day each</span>
      </div>

      {/* Two-Month Capacity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {monthlyCapacities.slice(0, 2).map((cap, idx) => (
          <div
            key={cap.monthKey}
            className={`rounded-xl p-4 border ${
              idx === 0
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">
                {idx === 0 ? '📅 Current' : '🔮 Next'}: {formatMonth(cap.monthKey)}
              </span>
              <span className={`text-sm font-bold ${
                cap.utilizationPct > 80 ? 'text-red-600' :
                cap.utilizationPct > 50 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {cap.utilizationPct}%
              </span>
            </div>

            {/* Utilization Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-700 ${
                  cap.utilizationPct > 80 ? 'bg-red-500' :
                  cap.utilizationPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(cap.utilizationPct, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Booked</span>
                <p className="font-semibold text-gray-800">
                  {(cap.bookedKg / 1000).toFixed(1)}T
                </p>
              </div>
              <div>
                <span className="text-gray-500">Available</span>
                <p className={`font-semibold ${
                  cap.availableKg > 50000 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(cap.availableKg / 1000).toFixed(1)}T
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Capacity Gauge */}
      <div className="flex items-center gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke={corrugatorUtilization > 80 ? '#ef4444' : corrugatorUtilization > 50 ? '#f59e0b' : '#10b981'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${corrugatorUtilization * 2.136} 213.6`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-800">{corrugatorUtilization}%</span>
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">{(bookedKg / 1000).toFixed(1)} tons</span> booked
          </p>
          <p className="text-sm text-gray-600">
            of <span className="font-semibold">{(totalMonthlyCapacityKg / 1000).toFixed(0)} tons</span> monthly capacity
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monthlyCapacities[0]?.activeBookings || 0} active bookings
          </p>
        </div>
      </div>

      {/* Recent Bookings */}
      {recentBookings.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">Recent Bookings</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {recentBookings.slice(0, 8).map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    b.status === 'in_production' ? 'bg-blue-500' : 'bg-amber-500'
                  }`} />
                  <span className="font-medium text-gray-800 truncate">
                    {b.customerName || 'Customer'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                  <span>{b.kgBooked} kg</span>
                  <span>{b.monthKey}</span>
                  <span>{b.deliveryEstimateDays}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

