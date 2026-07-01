'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface PriceConfig {
  id: string;
  base_price_janta: number;
  base_price_regular: number;
  base_price_silver: number;
  base_price_gold: number;
  base_price_platinum: number;
  effective_date: string;
  created_by: string;
  notes: string;
}

export default function BoxPricingPage() {
  const [priceConfig, setPriceConfig] = useState<PriceConfig | null>(null);
  const [prices, setPrices] = useState({
    janta: '',
    regular: '',
    silver: '',
    gold: '',
    platinum: ''
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load current pricing config
  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pricing/config');
      const data = await res.json();
      if (data.ok && data.config) {
        setPriceConfig(data.config);
        setPrices({
          janta: data.config.base_price_janta?.toString() || '',
          regular: data.config.base_price_regular?.toString() || '',
          silver: data.config.base_price_silver?.toString() || '',
          gold: data.config.base_price_gold?.toString() || '',
          platinum: data.config.base_price_platinum?.toString() || '',
        });
        setNotes(data.config.notes || '');
      }
    } catch (error) {
      console.error('Failed to load pricing:', error);
      setMessage('Failed to load current prices');
    }
    setLoading(false);
  };

  const updatePricing = async () => {
    // Validate inputs
    if (!prices.janta || !prices.regular || !prices.silver || !prices.gold || !prices.platinum) {
      setMessage('Please fill in all price fields');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/pricing/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePriceJanta: parseFloat(prices.janta),
          basePriceRegular: parseFloat(prices.regular),
          basePriceSilver: parseFloat(prices.silver),
          basePriceGold: parseFloat(prices.gold),
          basePricePlatinum: parseFloat(prices.platinum),
          createdBy: 'owner',
          notes: notes
        })
      });

      const data = await res.json();

      if (data.ok) {
        setPriceConfig(data.config);
        setMessage('✅ Box prices updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to update pricing:', error);
      setMessage('❌ Failed to update prices');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Box Pricing Configuration
          </h1>
          <p className="text-gray-600 mb-6">
            Set daily base prices for 13" box across all quality grades. 
            Other sizes will be calculated automatically based on premiums.
          </p>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${message.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}

          {priceConfig && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Current Prices (13" box, 3.0g):</h3>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Janta:</span> ₹{priceConfig.base_price_janta}/kg
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Regular:</span> ₹{priceConfig.base_price_regular}/kg
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Silver:</span> ₹{priceConfig.base_price_silver}/kg
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Gold:</span> ₹{priceConfig.base_price_gold}/kg
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Platinum:</span> ₹{priceConfig.base_price_platinum}/kg
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Last updated: {new Date(priceConfig.effective_date).toLocaleString()}
              </p>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Janta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Janta Quality
                  <span className="block text-xs text-gray-500 font-normal">45% PP, Strength 28-25</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={prices.janta}
                    onChange={(e) => setPrices({ ...prices, janta: e.target.value })}
                    className="w-full pl-8 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="100.00"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-500 text-sm">/kg</span>
                </div>
              </div>

              {/* Regular */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Regular Quality
                  <span className="block text-xs text-gray-500 font-normal">50% PP, Strength 30-35</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={prices.regular}
                    onChange={(e) => setPrices({ ...prices, regular: e.target.value })}
                    className="w-full pl-8 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="105.00"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-500 text-sm">/kg</span>
                </div>
              </div>

              {/* Silver */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Silver Quality
                  <span className="block text-xs text-gray-500 font-normal">55% PP, Strength 38-40</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={prices.silver}
                    onChange={(e) => setPrices({ ...prices, silver: e.target.value })}
                    className="w-full pl-8 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="110.00"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-500 text-sm">/kg</span>
                </div>
              </div>

              {/* Gold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gold Quality
                  <span className="block text-xs text-gray-500 font-normal">65% PP, Strength 50-55</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={prices.gold}
                    onChange={(e) => setPrices({ ...prices, gold: e.target.value })}
                    className="w-full pl-8 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="115.00"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-500 text-sm">/kg</span>
                </div>
              </div>

              {/* Platinum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platinum Quality
                  <span className="block text-xs text-gray-500 font-normal">75% PP, Strength 57-61</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={prices.platinum}
                    onChange={(e) => setPrices({ ...prices, platinum: e.target.value })}
                    className="w-full pl-8 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="120.00"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-500 text-sm">/kg</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="e.g., Market rate increase, seasonal adjustment..."
              />
            </div>

            {/* Pricing Info */}
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
              <h4 className="font-semibold mb-2">📊 Pricing Calculation Logic:</h4>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Base:</strong> 13" box, 3.0g grammage (prices you set above)</li>
                <li><strong>Size Premiums:</strong> 19" (+₹1/kg), 16"/17" (+₹10/kg), 12"/15" (+₹15/kg)</li>
                <li><strong>Grammage Discounts:</strong> 4.0-4.75g (base-₹1), 5.0-5.75g (base-₹2)</li>
                <li><strong>Color Premiums:</strong> Half-colored (+₹5/kg), Full-colored (+₹7/kg)</li>
                <li><strong>Lamination Premiums:</strong> Regular (+₹2/kg), Natural (+₹5/kg)</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={updatePricing}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-gray-400"
              >
                {loading ? 'Updating...' : 'Update Box Prices'}
              </Button>
              <Button
                onClick={loadPricing}
                disabled={loading}
                variant="ghost"
                className="px-6 border-gray-300 hover:bg-gray-50"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-2">💡 How to Use:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
            <li>Set base prices for 13" box in all 5 quality grades (Janta to Platinum)</li>
            <li>Prices are for 3.0g grammage, white color, unlaminated box</li>
            <li>The system automatically calculates prices for all other sizes, grammages, colors, and lamination options</li>
            <li>Ravi AI will use these prices to quote customers accurately</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

