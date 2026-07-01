'use client';

interface StageCount {
  stage: string;
  count: number;
}

interface OrderStatusCount {
  status: string;
  count: number;
}

interface OrdersPipelineProps {
  customerStages: StageCount[];
  ordersByStatus: OrderStatusCount[];
  totalCustomers: number;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  greeting: { label: 'New', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '👋' },
  collecting_specs: { label: 'Collecting Specs', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '📋' },
  quoting: { label: 'Quoting', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '💰' },
  price_agreed: { label: 'Price Agreed', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: '✅' },
  collecting_logistics: { label: 'Logistics', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: '🚚' },
  order_confirmed: { label: 'Confirmed', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: '📦' },
  in_production: { label: 'In Production', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '🏭' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '🎉' },
};

export function OrdersPipeline({ customerStages, ordersByStatus, totalCustomers }: OrdersPipelineProps) {
  // Merge customer stages with orders by status for a unified view
  const stageMap = new Map<string, number>();
  for (const s of customerStages) {
    stageMap.set(s.stage, (stageMap.get(s.stage) || 0) + s.count);
  }

  const stages = Object.entries(STAGE_CONFIG).map(([key, config]) => ({
    key,
    ...config,
    count: stageMap.get(key) || 0,
    pct: totalCustomers > 0 ? Math.round(((stageMap.get(key) || 0) / totalCustomers) * 100) : 0,
  }));

  const totalInPipeline = stages.filter(s => s.count > 0).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-gray-900">
          📊 Customer Pipeline
        </h3>
        <span className="text-sm text-gray-400">
          {totalCustomers} total customers · {totalInPipeline} active stages
        </span>
      </div>

      {/* Pipeline Stages */}
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center gap-3">
            <div className="w-32 shrink-0">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <span>{stage.icon}</span>
                {stage.label}
              </span>
            </div>
            <div className="flex-1">
              <div className={`h-8 rounded-lg ${stage.bg} border overflow-hidden relative`}>
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg transition-all duration-500"
                  style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 3 : 0)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-sm font-medium">
                  <span className={stage.count > 0 ? 'text-white drop-shadow-sm' : 'text-gray-400'}>
                    {stage.count} {stage.count === 1 ? 'customer' : 'customers'}
                    {stage.pct > 0 && ` (${stage.pct}%)`}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Order Status Summary */}
      {ordersByStatus.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Order Status</h4>
          <div className="flex flex-wrap gap-2">
            {ordersByStatus.map((os) => (
              <span
                key={os.status}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
              >
                {os.status.replace(/_/g, ' ')}: {os.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

