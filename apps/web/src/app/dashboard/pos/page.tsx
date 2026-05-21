'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Product {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  currentStock: number;
  barcode?: string;
  imageUrl?: string;
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:3001/inventory/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      // Use demo products if API fails
      setProducts([
        { id: '1', name: 'لابتوب Dell', sku: 'LAP-DELL-001', salePrice: 3200, currentStock: 15, barcode: '1234567890123' },
        { id: '2', name: 'ماوس لاسلكي', sku: 'MOUSE-WL-001', salePrice: 75, currentStock: 50, barcode: '1234567890124' },
        { id: '3', name: 'شاشة 27 بوصة', sku: 'MON-27-001', salePrice: 1100, currentStock: 8, barcode: '1234567890125' },
        { id: '4', name: 'مياه معدنية', sku: 'WAT-500-001', salePrice: 2.5, currentStock: 200, barcode: '1234567890126' },
        { id: '5', name: 'كرسي مكتبي', sku: 'CHR-OFF-001', salePrice: 500, currentStock: 12, barcode: '1234567890127' },
      ]);
    }
  };

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) return;
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: Number(product.salePrice),
        quantity: 1,
        total: Number(product.salePrice),
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: qty, total: qty * item.price }
        : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxRate = 0.15;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  const change = Math.max(0, Number(cashReceived || 0) - total);

  const handleBarcode = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const product = products.find(p => (p.barcode && p.barcode === barcode) || p.sku === barcode);
      if (product) {
        addToCart(product);
        setBarcode('');
      }
    }
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const orderData = {
        customerName: customerName || undefined,
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price.toString(),
        })),
        payments: [{
          method: 'CASH',
          amount: total.toFixed(2),
        }],
      };

      const res = await fetch('http://localhost:3001/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (res.ok) {
        const orderData = await res.json();
        setReceipt({
          orderNumber: orderData.orderNumber,
          date: new Date().toLocaleString('ar-SA'),
          items: cart,
          subtotal,
          taxAmount,
          total,
          cashReceived: Number(cashReceived || 0),
          change,
          customerName: customerName || 'عميل نقدي',
        });
        setMessage('✅ تم إتمام البيع بنجاح!');
        setCart([]);
        setCashReceived('');
        setCustomerName('');
        fetchProducts();
      } else {
        setMessage('❌ فشل في إتمام البيع');
      }
    } catch (e) {
      setMessage('❌ خطأ في الاتصال بالسيرفر');
    }
    setLoading(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">🛒 نقطة البيع (POS)</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-center ${message.includes('✅') ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Products Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="🔍 بحث أو مسح الباركود..."
              className="flex-1 p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <input
              type="text"
              placeholder="📷 باركود..."
              className="w-40 p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              onKeyDown={handleBarcode}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.currentStock <= 0}
                className={`p-4 rounded-xl border text-right transition-all ${
                  product.currentStock > 0
                    ? 'bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-750'
                    : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="font-bold text-sm mb-1">{product.name}</div>
                <div className="text-blue-400 font-bold">{Number(product.salePrice).toFixed(2)} ريال</div>
                <div className="text-xs text-slate-500 mt-1">مخزون: {product.currentStock}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
          <h2 className="text-lg font-bold">🧾 سلة المشتريات</h2>

          <input
            type="text"
            placeholder="اسم العميل (اختياري)"
            className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center text-slate-500 py-8">السلة فارغة</div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="flex items-center gap-2 bg-slate-800 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.price.toFixed(2)} × {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    >-</button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    >+</button>
                  </div>
                  <div className="text-sm font-bold w-16 text-right">{item.total.toFixed(2)}</div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-red-400 hover:text-red-300 text-sm px-1"
                  >×</button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>الإجمالي:</span><span>{subtotal.toFixed(2)} ريال</span></div>
            <div className="flex justify-between"><span>الضريبة (15%):</span><span>{taxAmount.toFixed(2)} ريال</span></div>
            <div className="flex justify-between text-lg font-bold text-blue-400"><span>الإجمالي النهائي:</span><span>{total.toFixed(2)} ريال</span></div>
          </div>

          <div className="space-y-2">
            <input
              type="number"
              placeholder="المبلغ المستلم"
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
              value={cashReceived}
              onChange={e => setCashReceived(e.target.value)}
            />
            {Number(cashReceived) > 0 && (
              <div className="text-center text-green-400">
                الباقي: {change.toFixed(2)} ريال
              </div>
            )}
          </div>

          <button
            onClick={submitOrder}
            disabled={cart.length === 0 || loading}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed font-bold transition-colors"
          >
            {loading ? '⏳ جاري المعالجة...' : '✅ إتمام البيع'}
          </button>

          {receipt && (
            <>
              <button
                onClick={() => window.print()}
                className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 font-bold mt-2"
              >
                🖨️ طباعة الفاتورة
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold mt-2"
              >
                فاتورة جديدة
              </button>
            </>
          )}
        </div>
      </div>

      {/* Thermal Receipt */}
      {receipt && (
        <div ref={receiptRef} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static print:block">
          <div className="bg-white text-black p-6 w-80 print:w-full print:shadow-none print:border-0"
            style={{ fontFamily: 'monospace', maxWidth: '320px' }}>
            <div className="text-center border-b-2 border-black pb-3 mb-3">
              <h2 className="text-xl font-bold">شركة التقنية المتقدمة</h2>
              <p className="text-xs">الرياض، المملكة العربية السعودية</p>
              <p className="text-xs">الرقم الضريبي: 300123456700003</p>
            </div>

            <div className="text-xs mb-3">
              <p>رقم الفاتورة: {receipt.orderNumber}</p>
              <p>التاريخ: {receipt.date}</p>
              <p>العميل: {receipt.customerName}</p>
            </div>

            <div className="border-t border-dashed border-black py-2">
              {receipt.items.map((item: any) => (
                <div key={item.productId} className="flex justify-between text-sm mb-1">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-black py-2 text-sm">
              <div className="flex justify-between"><span>الإجمالي:</span><span>{receipt.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>الضريبة (15%):</span><span>{receipt.taxAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg mt-2"><span>الإجمالي النهائي:</span><span>{receipt.total.toFixed(2)} ريال</span></div>
              <div className="flex justify-between mt-1"><span>المستلم:</span><span>{receipt.cashReceived.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>الباقي:</span><span>{receipt.change.toFixed(2)}</span></div>
            </div>

            <div className="text-center mt-4">
              <QRCodeSVG value={`https://zatca.gov.sa/verify?invoice=${receipt.orderNumber}`} size={120} className="mx-auto" />
              <p className="text-xs mt-2">امسح للتحقق من الفاتورة</p>
            </div>

            <div className="text-center text-xs mt-4 border-t border-black pt-2">
              <p>شكراً لك!</p>
              <p>SCC 380 - Smart Command Center</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
