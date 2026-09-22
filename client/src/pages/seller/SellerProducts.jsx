import { useEffect, useState } from 'react';
import { sellerListProducts, sellerCreateProduct, sellerUpdateProduct, sellerDeleteProduct, sellerUploadProductImage } from '../../services/sellerService';
import { useToast } from '../../context/ToastContext';
import { formatINR } from '../../utils/currency';

const EMPTY_FORM = { name: '', category: '', description: '', price: '', stock: '' };

function toEditForm(product) {
  return {
    name: product.name || '',
    category: product.category || '',
    description: product.description || '',
    price: product.price ?? '',
    stock: product.stock ?? '',
    isActive: product.isActive !== false,
  };
}

export default function SellerProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    sellerListProducts({ limit: 50 }).then((data) => setProducts(data.products || [])).finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await sellerCreateProduct({
        ...form,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        images: ['https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=400'],
      });
      setForm(EMPTY_FORM);
      showToast('Product created — add a real photo below', 'success');
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Could not create product');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await sellerDeleteProduct(id);
      setProducts((prev) => prev.filter((p) => p._id !== id));
      showToast('Product deleted', 'success');
    } catch {
      showToast('Could not delete product', 'error');
    }
  };

  const toggleExpand = (product) => {
    if (expandedId === product._id) {
      setExpandedId(null);
      setEditForm(null);
    } else {
      setExpandedId(product._id);
      setEditForm(toEditForm(product));
    }
  };

  const handleSaveEdit = async (id) => {
    setSavingEdit(true);
    try {
      const updated = await sellerUpdateProduct(id, {
        ...editForm,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
      });
      setProducts((prev) => prev.map((p) => (p._id === id ? updated : p)));
      showToast('Product updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update product', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleImageUpload = async (id, file) => {
    if (!file) return;
    try {
      const updated = await sellerUploadProductImage(id, file);
      setProducts((prev) => prev.map((p) => (p._id === id ? updated : p)));
      showToast('Image uploaded', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Image upload failed', 'error');
    }
  };

  const inputClass = 'rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <div>
      <form onSubmit={handleCreate} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Add New Product</h3>
        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          <input required placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} />
          <input required type="number" placeholder="Price (₹)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputClass} />
          <input required type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={inputClass} />
          <textarea required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`col-span-full h-20 resize-none ${inputClass}`} />
        </div>
        <button type="submit" disabled={creating} className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {creating ? 'Creating...' : 'Create Product'}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-zinc-400">You haven't listed any products yet.</p>
        ) : (
          products.map((product) => {
            const isExpanded = expandedId === product._id;
            return (
              <div key={product._id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src={product.primaryImage || product.images?.[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{product.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatINR(product.price)} · Stock: {product.stock} · {product.category}
                        {product.stock <= (product.lowStockThreshold ?? 5) && <span className="ml-1.5 font-semibold text-rose-500">· Low stock</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleExpand(product)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700">
                      {isExpanded ? 'Close' : 'Manage'}
                    </button>
                    <button onClick={() => handleDelete(product._id)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && editForm && (
                  <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input placeholder="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
                      <input placeholder="Category" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className={inputClass} />
                      <input type="number" placeholder="Price (₹)" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className={inputClass} />
                      <input type="number" placeholder="Stock" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} className={inputClass} />
                      <textarea placeholder="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={`col-span-full h-20 resize-none ${inputClass}`} />
                      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                        Listed (visible to customers)
                      </label>
                    </div>
                    <button onClick={() => handleSaveEdit(product._id)} disabled={savingEdit} className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                      {savingEdit ? 'Saving...' : 'Save Changes'}
                    </button>
                    <div>
                      <label className="text-xs font-semibold text-zinc-500">Upload Image</label>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(product._id, e.target.files?.[0])} className="mt-1 block text-xs text-zinc-500" />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
