'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface PriceConfig {
  id: string;
  base_price_3g: number;
  effective_date: string;
  created_by: string;
  notes: string;
}

export default function BoxPricingPage() {
  const [priceConfig, setPriceConfig] = useState<PriceConfig | null>(null);
  const [basePrice, setBasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
        setBasePrice(data.config.base_price_3g?.toString() || '');
        setNotes(data.config.notes || '');
      }
    } catch (error) {
      console.error('Failed to load pricing:', error);
      setMessage('Failed to load current prices');
    }
    setLoading(false);
  };

  const updatePricing = async () => {
    if (!basePrice) {
      setMessage('Please enter a base paper price');
      return;
    }

    const bp = parseFloat(basePrice);
    if (isNaN(bp) || bp <= 0) {
      setMessage('Please enter a valid price above 0');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/pricing/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePriceJanta: bp,
          basePriceRegular: bp,
          basePriceSilver: bp,
          basePriceGold: bp,
          basePricePlatinum: bp,
          createdBy: 'owner',
          notes: notes
        })
      });

      const data = await res.json();

      if (data.ok) {
        setPriceConfig(data.config);
        setMessage('✅ Box base price updated successfully!');
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

  const bp = parseFloat(basePrice) || 80;
  const calc3ply  = (bp * 0.4).toFixed(2);
  const calc5ply  = (bp * 0.563).toFixed(2);
  const calc7ply  = (bp * 0.75).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📦 Box Pricing Configuration
          </h1>
          <p className="text-gray-600 mb-6">
            Set today&apos;s raw paper (Kraft) base price. All box prices are automatically calculated from this single value.
          </p>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${message.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}

          {priceConfig && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Current Active Base Price:</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Paper Base Price:</span>{' '}
                  ₹{priceConfig.base_price_3g}/unit
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Last Updated:</span>{' '}
                  {new Date(priceConfig.effective_date).toLocaleDateString('en-IN')}
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Updated By:</span>{' '}
                  {priceConfig.created_by}
                </div>
              </div>
            </div>
          )}

          {/* Live Price Preview */}
          {basePrice && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-3">📊 Live Price Preview (based on ₹{basePrice}/unit base):</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white rounded p-3 border border-green-100">
                  <div className="font-bold text-green-800 text-lg">3-Ply Box</div>
                  <div className="text-gray-600 text-xs mb-1">Standard Shipping Carton</div>
                  <div className="text-2xl font-bold text-gray-900">₹{calc3ply}<span className="text-sm font-normal text-gray-500">/box</span></div>
                  <div className="text-xs text-gray-400 mt-1">base × 0.40</div>
                </div>
                <div className="bg-white rounded p-3 border border-green-100">
                  <div className="font-bold text-green-800 text-lg">5-Ply Box</div>
                  <div className="text-gray-600 text-xs mb-1">Heavy-Duty Shipping Carton</div>
                  <div className="text-2xl font-bold text-gray-900">₹{calc5ply}<span className="text-sm font-normal text-gray-500">/box</span></div>
                  <div className="text-xs text-gray-400 mt-1">base × 0.563</div>
                </div>
                <div className="bg-white rounded p-3 border border-green-100">
                  <div className="font-bold text-green-800 text-lg">7-Ply Box</div>
                  <div className="text-gray-600 text-xs mb-1">Heavy Industrial Storage Box</div>
                  <div className="text-2xl font-bold text-gray-900">₹{calc7ply}<span className="text-sm font-normal text-gray-500">/box</span></div>
                  <div className="text-xs text-gray-400 mt-1">base × 0.75</div>
                </div>
              </div>
              <p className="text-xs text-green-700 mt-2">* Prices above are base only. Premiums for size, GSM, printing, and lamination are added on top.</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Single Base Price Input */}
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Today&apos;s Kraft Paper Base Price (₹/unit)
                <span className="block text-xs text-gray-500 font-normal mt-0.5">
                  Market-linked raw paper cost. All ply prices are derived from this.
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full pl-8 pr-16 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
                  placeholder="80.00"
                />
                <span className="absolute right-3 top-3 text-gray-500 text-sm">/unit</span>
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
                rows={2}
                placeholder="e.g., Market rate increase, seasonal adjustment..."
              />
            </div>

            {/* Pricing Info */}
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
              <h4 className="font-semibold mb-2">📊 Automatic Premium Structure:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div><strong>3-Ply (Standard):</strong> Base × 0.40</div>
                <div><strong>5-Ply (Heavy):</strong> Base × 0.563</div>
                <div><strong>7-Ply (Industrial):</strong> Base × 0.75</div>
                <div><strong>Size Medium (21-40&quot;):</strong> +₹5/box</div>
                <div><strong>Size Large (&gt;40&quot;):</strong> +₹12/box</div>
                <div><strong>150 GSM paper:</strong> +₹4/box</div>
                <div><strong>200 GSM paper:</strong> +₹8/box</div>
                <div><strong>Flexo Printed:</strong> +₹3/box</div>
                <div><strong>Offset Printed:</strong> +₹7/box</div>
                <div><strong>Film Lamination:</strong> +₹4/box</div>
                <div><strong>UV Coating:</strong> +₹6/box</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={updatePricing}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-gray-400"
              >
                {loading ? 'Updating...' : '💾 Update Base Price'}
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
          <h3 className="font-semibold text-yellow-900 mb-2">💡 How Pricing Works:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
            <li>Enter today&apos;s Kraft paper market price (e.g. ₹80/unit)</li>
            <li>The system auto-calculates 3-Ply, 5-Ply, and 7-Ply box prices</li>
            <li>Premiums for box size, GSM, printing, and lamination are added automatically</li>
            <li>The AI Sales Agent uses these prices to quote customers instantly and accurately</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
